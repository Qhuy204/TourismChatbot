import asyncio
import csv
import os
import re
import aiohttp
from unidecode import unidecode
from playwright.async_api import async_playwright

# --- CẤU HÌNH ---
# Danh sách file đầu vào và cấu hình crawl riêng cho từng loại
# type: xác định logic crawl (restaurant khác với phần còn lại)
CONFIGS = [
    {
        "input_csv": "restaurant.csv",
        "output_csv": "restaurant_full.csv",
        "cate_name": "restaurant",
        "type": "restaurant" 
    },
    {
        "input_csv": "shop.csv",
        "output_csv": "shop_full.csv",
        "cate_name": "shop",
        "type": "generic"
    },
    {
        "input_csv": "destination.csv",
        "output_csv": "destination_full.csv",
        "cate_name": "destination",
        "type": "generic"
    },
    {
        "input_csv": "entertainment.csv",
        "output_csv": "entertainment_full.csv",
        "cate_name": "entertainment",
        "type": "generic"
    }
]

# --- HÀM HỖ TRỢ ---

def slugify(text):
    """Chuyển tên thành dạng thư mục: 'Hồ Ea Snô' -> 'Ho_Ea_Sno'"""
    if not text:
        return "unknown"
    text = unidecode(text).strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '_', text)

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def extract_content_from_label(text, label_prefix):
    """Lấy nội dung sau dấu : của các label (ví dụ: Giờ mở cửa: 08:00)"""
    if not text:
        return ""
    return text.replace(label_prefix, "").replace(":", "").strip()

async def download_image(session, url, folder_path, index):
    """Tải ảnh async"""
    if not url or not url.startswith("http"):
        return
    
    try:
        # Lấy đuôi file (jpg, png)
        ext = url.split('.')[-1].split('?')[0]
        if len(ext) > 4: ext = "jpg"
        
        filename = f"image_{index}.{ext}"
        file_path = os.path.join(folder_path, filename)

        if os.path.exists(file_path):
            return

        async with session.get(url, timeout=10) as response:
            if response.status == 200:
                with open(file_path, 'wb') as f:
                    f.write(await response.read())
    except Exception as e:
        print(f"Lỗi tải ảnh {url}: {e}")

# --- LOGIC CRAWL CHI TIẾT ---

async def extract_details(page, config_type):
    data = {
        "Description": "",
        "OpenTime": "",
        "CloseTime": "",
        "Phone": "",
        "Email": "",
        "Website": "",
        "Image_Urls": []
    }

    try:
        # 1. Lấy Giờ mở cửa / Đóng cửa (Dựa trên label for="time1/2")
        # Sử dụng selector lỏng lẻo hơn để tránh lỗi nếu ID thay đổi, nhưng check text
        open_time_loc = page.locator('label:has-text("Giờ mở cửa")')
        close_time_loc = page.locator('label:has-text("Giờ đóng cửa")')
        
        if await open_time_loc.count() > 0:
            raw = await open_time_loc.first.inner_text()
            data["OpenTime"] = raw.split(":")[-1].strip() if ":" in raw else raw
            
        if await close_time_loc.count() > 0:
            raw = await close_time_loc.first.inner_text()
            data["CloseTime"] = raw.split(":")[-1].strip() if ":" in raw else raw

        # 2. Lấy Description (Nằm trong col-12 py-2)
        # Loại trừ phần chứa Giờ mở cửa (thường cũng nằm trong col-12 py-2)
        desc_elements = page.locator(".col-12.py-2:not(:has(label))")
        desc_texts = await desc_elements.all_inner_texts()
        data["Description"] = "\n".join([clean_text(t) for t in desc_texts if t.strip()])

        # 3. Lấy thông tin liên hệ (Phone, Email, Web)
        # Chỉ áp dụng cho loại generic (Shop, Dest, Ent) vì Restaurant thường đã có ở bảng ngoài, 
        # nhưng code yêu cầu tự trích xuất lại cho chắc chắn.
        if config_type == "generic" or True: # Luôn lấy lại cho đầy đủ
            detail_box = page.locator(".cslt-detail")
            
            # Phone: Xử lý lỗi Strict Mode bằng cách lấy .first hoặc all
            phone_items = detail_box.locator(".fa-phone")
            if await phone_items.count() > 0:
                # Lấy thẻ cha (span hoặc div) chứa icon phone
                parent = phone_items.first.locator("..") 
                raw_phone = await parent.inner_text()
                # Clean text: Điện thoại cố định: 0271... -> 0271...
                data["Phone"] = re.sub(r'(Điện thoại.*?|Tel|:)', '', raw_phone).strip()

            # Email
            email_items = detail_box.locator(".fa-envelope-o")
            if await email_items.count() > 0:
                parent = email_items.first.locator("..")
                raw_email = await parent.inner_text()
                data["Email"] = raw_email.replace("Email:", "").strip()

            # Website
            web_items = detail_box.locator(".fa-globe")
            if await web_items.count() > 0:
                parent = web_items.first.locator("..")
                raw_web = await parent.inner_text()
                data["Website"] = raw_web.replace("Website:", "").strip()

        # 4. Lấy Link Ảnh
        # Logic: 
        # - Restaurant: Chỉ lấy trong .col-md-12.mx-0.list-3
        # - Generic: Lấy cả .listing-shot-img VÀ .col-md-12.mx-0.list-3
        
        imgs = []
        
        # Ảnh gallery (chung cho tất cả)
        gallery_loc = page.locator(".col-md-12.mx-0.list-3 img")
        count_g = await gallery_loc.count()
        for i in range(count_g):
            src = await gallery_loc.nth(i).get_attribute("src")
            if src: imgs.append(src)

        # Ảnh đại diện (chỉ cho generic)
        if config_type == "generic":
            thumb_loc = page.locator(".listing-shot-img img")
            count_t = await thumb_loc.count()
            for i in range(count_t):
                src = await thumb_loc.nth(i).get_attribute("src")
                if src: imgs.append(src)
        
        data["Image_Urls"] = list(set(imgs)) # Loại bỏ trùng

    except Exception as e:
        print(f"!! Lỗi khi parse chi tiết: {e}")

    return data

# --- MAIN PROCESS ---

async def process_file(browser, config, session):
    input_file = config["input_csv"]
    output_file = config["output_csv"]
    cate_dir = config["cate_name"]
    
    if not os.path.exists(input_file):
        print(f"Không tìm thấy file {input_file}, bỏ qua.")
        return

    # Tạo thư mục danh mục
    if not os.path.exists(cate_dir):
        os.makedirs(cate_dir)

    print(f"=== Bắt đầu xử lý: {input_file} -> {output_file} ===")

    # Đọc dữ liệu đầu vào
    rows = []
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Xác định fieldnames cho output
    fieldnames = list(rows[0].keys())
    new_fields = ["OpenTime", "CloseTime", "Description", "Email", "Website"]
    for nf in new_fields:
        if nf not in fieldnames:
            fieldnames.append(nf)

    # Mở file output để ghi dần
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f_out:
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        context = await browser.new_context()
        # Chặn hình ảnh/font khi load page để crawl nhanh hơn (ảnh tải bằng aiohttp riêng)
        await context.route("**/*.{png,jpg,jpeg,gif,webp}", lambda route: route.abort())
        await context.route("**/*.{woff,woff2}", lambda route: route.abort())
        
        page = await context.new_page()

        for idx, row in enumerate(rows):
            url = row.get("Link", "")
            name = row.get("Name", "NoName")
            print(f"[{idx+1}/{len(rows)}] Crawling: {name}")

            if not url or "http" not in url:
                writer.writerow(row)
                continue

            try:
                await page.goto(url, timeout=30000, wait_until="domcontentloaded")
                
                # Extract data
                details = await extract_details(page, config["type"])
                
                # Merge data vào row hiện tại
                row["OpenTime"] = details["OpenTime"]
                row["CloseTime"] = details["CloseTime"]
                row["Description"] = details["Description"]
                
                # Ghi đè Phone nếu generic crawl được (vì csv cũ có thể lỗi format)
                if details["Phone"]:
                    row["Phone"] = details["Phone"]
                    
                row["Email"] = details["Email"]
                row["Website"] = details["Website"]

                # Tải ảnh
                image_urls = details["Image_Urls"]
                if image_urls:
                    item_slug = slugify(name)
                    item_dir = os.path.join(cate_dir, item_slug)
                    if not os.path.exists(item_dir):
                        os.makedirs(item_dir)
                    
                    # Tải song song các ảnh của 1 địa điểm
                    tasks = []
                    for img_idx, img_url in enumerate(image_urls):
                        # Fix link ảnh tương đối
                        if not img_url.startswith("http"):
                            if img_url.startswith("/"):
                                img_url = "https://csdl.vietnamtourism.gov.vn" + img_url
                        
                        tasks.append(download_image(session, img_url, item_dir, img_idx))
                    
                    if tasks:
                        await asyncio.gather(*tasks)

                writer.writerow(row)

            except Exception as e:
                print(f"Lỗi crawl URL {url}: {e}")
                writer.writerow(row) # Ghi lại dòng cũ để không mất data
        
        await context.close()

async def main():
    async with aiohttp.ClientSession() as session:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            
            for config in CONFIGS:
                await process_file(browser, config, session)
            
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())