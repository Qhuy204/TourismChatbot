import asyncio
import csv
import re
from playwright.async_api import async_playwright

# Cấu hình các trang cần crawl
# Định dạng: URL gốc, Tên file lưu, Số trang tối đa
CONFIGS = [
    {
        "url": "https://csdl.vietnamtourism.gov.vn/dest",
        "file": "destination.csv",
        "max_page": 65
    },
    {
        "url": "https://csdl.vietnamtourism.gov.vn/cslt",
        "file": "hotel.csv",
        "max_page": 955
    },
    {
        "url": "https://csdl.vietnamtourism.gov.vn/shop",
        "file": "shop.csv",
        "max_page": 46
    },
    {
        "url": "https://csdl.vietnamtourism.gov.vn/vcgt",
        "file": "entertainment.csv", # Đã sửa đuôi .sv thành .csv
        "max_page": 25
    },
    {
        "url": "https://csdl.vietnamtourism.gov.vn/rest",
        "file": "restaurant.csv",
        "max_page": 172
    }
]

BASE_URL = "https://csdl.vietnamtourism.gov.vn"

def clean_text(text):
    """Làm sạch văn bản: xóa khoảng trắng thừa, xuống dòng"""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def remove_prefix(text, prefix_list):
    """Xóa các từ khóa như 'Địa chỉ:', 'Điện thoại:' khỏi chuỗi"""
    clean = text
    for p in prefix_list:
        clean = clean.replace(p, "")
    return clean.strip()

async def crawl_category(browser, config):
    url_base = config["url"]
    file_path = config["file"]
    max_page = config["max_page"]
    
    print(f"--- Bắt đầu crawl: {file_path} (Tổng số trang: {max_page}) ---")

    # Mở file CSV để ghi
    with open(file_path, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=["Name", "Address", "Phone", "Link"])
        writer.writeheader()

        # Tạo context mới cho mỗi category
        context = await browser.new_context()
        page = await context.new_page()

        # Loop qua từng trang
        for page_num in range(1, max_page + 1):
            full_url = f"{url_base}/?page={page_num}"
            print(f"Đang xử lý: {file_path} - Page {page_num}/{max_page}")

            try:
                # Goto page với timeout 60s
                await page.goto(full_url, timeout=60000, wait_until="domcontentloaded")
                
                # Selector lấy tất cả các box chứa thông tin
                items = page.locator(".verticle-listing-caption")
                count = await items.count()

                if count == 0:
                    print(f"Cảnh báo: Không tìm thấy dữ liệu tại trang {page_num}")
                    continue

                for i in range(count):
                    item = items.nth(i)
                    
                    # 1. Lấy Tên và Link
                    name_locator = item.locator("h4 a")
                    name = await name_locator.inner_text()
                    href = await name_locator.get_attribute("href")
                    full_link = BASE_URL + href if href else ""

                    # 2. Lấy Địa chỉ (Tìm thẻ span chứa icon map-marker)
                    address = ""
                    addr_loc = item.locator("span:has(.fa-map-marker)")
                    if await addr_loc.count() > 0:
                        raw_addr = await addr_loc.inner_text()
                        address = remove_prefix(raw_addr, ["Địa chỉ:", "Address:"])

                    # 3. Lấy Điện thoại (Tìm thẻ span chứa icon phone)
                    phone = ""
                    phone_loc = item.locator("span:has(.fa-phone)")
                    if await phone_loc.count() > 0:
                        raw_phone = await phone_loc.inner_text()
                        # Xóa các từ thừa, giữ lại số
                        phone = remove_prefix(raw_phone, ["Điện thoại cố định:", "Tel:", "Điện thoại:"])

                    # Ghi dòng vào CSV
                    writer.writerow({
                        "Name": clean_text(name),
                        "Address": clean_text(address),
                        "Phone": clean_text(phone),
                        "Link": full_link
                    })
            
            except Exception as e:
                print(f"Lỗi tại trang {page_num} ({url_base}): {e}")
                # Nếu lỗi timeout thì thử load lại hoặc bỏ qua, ở đây ta bỏ qua để chạy tiếp
                continue
        
        await context.close()
    print(f"--- Hoàn thành: {file_path} ---\n")

async def main():
    async with async_playwright() as p:
        # Chạy browser ở chế độ headless (không hiện giao diện) cho nhanh
        browser = await p.chromium.launch(headless=True)
        
        # Chạy lần lượt từng category
        for config in CONFIGS:
            await crawl_category(browser, config)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())