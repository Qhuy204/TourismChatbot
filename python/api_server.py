import asyncio
import json
import csv
import os
import re
import io
import psutil
import shutil
import zipfile
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
import aiohttp
from unidecode import unidecode

try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

# --- Configuration ---
BASE_URL = "https://csdl.vietnamtourism.gov.vn"
DATA_DIR = "crawled_data"
HISTORY_DIR = os.path.join(DATA_DIR, "history")  # history/{category}/{timestamp}/ - version tracking
IMAGES_DIR = os.path.join(DATA_DIR, "images")   # images/{category}/{item_slug}/ - central storage

# Category configs
CATEGORY_CONFIGS = {
    "destinations": {"url_path": "/dest", "type": "generic", "fallback_max_page": 65, "output_file": "destination.csv"},
    "hotels": {"url_path": "/cslt", "type": "hotel", "fallback_max_page": 955, "output_file": "hotel.csv"},
    "shops": {"url_path": "/shop", "type": "generic", "fallback_max_page": 46, "output_file": "shop.csv"},
    "entertainment": {"url_path": "/vcgt", "type": "generic", "fallback_max_page": 25, "output_file": "entertainment.csv"},
    "restaurants": {"url_path": "/rest", "type": "restaurant", "fallback_max_page": 172, "output_file": "restaurant.csv"}
}

# Gemini model rate limits
MODEL_RATE_LIMITS = {
    "gemini-2.5-flash": {"rpm": 1000, "tpm": 1000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-2.5-pro": {"rpm": 150, "tpm": 2000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-2.5-flash-lite": {"rpm": 4000, "tpm": 4000000, "rpd": -1, "category": "Text-out models"},
    "gemini-2.0-flash": {"rpm": 2000, "tpm": 4000000, "rpd": -1, "category": "Text-out models"},
    "gemini-3-flash": {"rpm": 1000, "tpm": 1000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-3-pro": {"rpm": 25, "tpm": 1000000, "rpd": 250, "category": "Text-out models"},
}

# Data Models
class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"

class CrawlRequest(BaseModel):
    categories: List[str]
    max_pages_per_category: Optional[int] = None
    crawl_details: Optional[bool] = False
    concurrency_limit: Optional[int] = 5  # Number of concurrent tabs/requests

class APIKeyRequest(BaseModel):
    provider: str
    api_key: str

class BatchDownloadRequest(BaseModel):
    sessions: List[Dict[str, str]] # [{ "category": "hotels", "timestamp": "...", "type": "data"|"images" }]

# Global State
crawl_status = {
    "is_running": False, 
    "message": "Ready", 
    "logs": [], 
    "failed_pages": [], 
    "items_crawled": 0,
    "current_category": None,
    "current_page": 0,
    "total_pages": 0
}
active_connections: List[WebSocket] = []
crawl_task = None
should_stop = False  # Flag to stop crawl immediately

# Helpers
def slugify(text: str) -> str:
    if not text: return "unknown"
    text = unidecode(text).strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '_', text)

def clean_text(text: str) -> str:
    if not text: return ""
    return re.sub(r'\s+', ' ', text).strip()

def remove_prefix(text: str, prefix_list: List[str]) -> str:
    clean = text
    for p in prefix_list:
        clean = clean.replace(p, "")
    return clean.strip()

def add_log(level: LogLevel, category: str, message: str):
    global crawl_status
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "level": level.value,
        "category": category,
        "message": message
    }
    crawl_status["logs"].append(log_entry)
    if len(crawl_status["logs"]) > 500:
        crawl_status["logs"] = crawl_status["logs"][-500:]
    return log_entry

async def broadcast(msg_type: str, data: Any):
    if not active_connections: return
    msg = json.dumps({"type": msg_type, "data": data})
    for conn in active_connections[:]:
        try:
            await conn.send_text(msg)
        except:
            if conn in active_connections:
                active_connections.remove(conn)

# === HISTORY MANAGEMENT ===
def get_history():
    """Scan history directory for available sessions"""
    history = {}
    if not os.path.exists(HISTORY_DIR):
        return history
    
    for category in os.listdir(HISTORY_DIR):
        cat_dir = os.path.join(HISTORY_DIR, category)
        if not os.path.isdir(cat_dir): continue
        
        history[category] = []
        for ts in os.listdir(cat_dir):
            ts_dir = os.path.join(cat_dir, ts)
            data_file = os.path.join(ts_dir, "data.csv")
            
            if os.path.exists(data_file):
                # Count items
                item_count = 0
                try:
                    with open(data_file, 'r', encoding='utf-8-sig') as f:
                        item_count = sum(1 for _ in f) - 1 # minus header
                except: pass
                
                # Check images
                img_count = 0
                img_dir = os.path.join(ts_dir, "images")
                if os.path.exists(img_dir):
                    for _, _, files in os.walk(img_dir):
                        img_count += len(files)
                
                history[category].append({
                    "timestamp": ts,
                    "item_count": max(0, item_count),
                    "image_count": img_count,
                    "path": ts_dir
                })
        
        # Sort by timestamp desc
        history[category].sort(key=lambda x: x["timestamp"], reverse=True)
        
    return history

def cleanup_old_versions(category: str):
    """Keep only last 3 versions"""
    cat_dir = os.path.join(HISTORY_DIR, category)
    if not os.path.exists(cat_dir): return
    
    versions = sorted(os.listdir(cat_dir))
    if len(versions) > 3:
        to_remove = versions[:-3]
        for v in to_remove:
            path = os.path.join(cat_dir, v)
            try:
                shutil.rmtree(path)
                print(f"Cleaned up old version: {path}")
            except Exception as e:
                print(f"Cleanup error: {e}")

def load_existing_items(category: str) -> Dict[str, Dict]:
    """Load all existing items from previous crawls of this category.
    
    Returns a dict: {link: {"has_details": bool, "has_images": bool, "image_folder": str}}
    This allows incremental crawling with awareness of what data exists.
    
    Priority: Master file first, then history folders (to get image paths)
    """
    existing_items = {}
    
    # 1. Load from MASTER file first (the source of truth)
    config = CATEGORY_CONFIGS.get(category, {})
    master_file = os.path.join(DATA_DIR, config.get("output_file", ""))
    
    if master_file and os.path.exists(master_file):
        try:
            with open(master_file, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    link = row.get("Link", "").strip()
                    if not link:
                        continue
                    
                    has_details = bool(
                        row.get("Description", "").strip() or 
                        row.get("OpenTime", "").strip() or
                        row.get("Email", "").strip() or
                        row.get("Website", "").strip()
                    )
                    
                    # Check for images - try both old ImageFolder path and new central location
                    image_folder = row.get("ImageFolder", "").strip()
                    has_images = False
                    image_count = 0
                    
                    # First check if ImageFolder path exists
                    if image_folder and os.path.exists(image_folder):
                        try:
                            image_count = len([f for f in os.listdir(image_folder) if f.startswith("image_")])
                            has_images = image_count > 0
                        except:
                            pass
                    
                    # Fallback: check central images folder
                    if not has_images:
                        item_name = row.get("Name", "").strip()
                        if item_name:
                            item_slug = slugify(item_name)
                            central_folder = os.path.join(IMAGES_DIR, category, item_slug)
                            if os.path.exists(central_folder):
                                try:
                                    image_count = len([f for f in os.listdir(central_folder) if f.startswith("image_")])
                                    has_images = image_count > 0
                                    if has_images:
                                        image_folder = central_folder
                                except:
                                    pass
                    
                    # Fallback: ImageCount field
                    if not has_images and row.get("ImageCount"):
                        try:
                            image_count = int(row.get("ImageCount", 0))
                            has_images = image_count > 0
                        except:
                            pass
                    
                    existing_items[link] = {
                        "has_details": has_details,
                        "has_images": has_images,
                        "image_folder": image_folder,
                        "image_count": image_count
                    }
        except Exception as e:
            print(f"Error loading master file {master_file}: {e}")
    
    # 2. Supplement with history folders (for image paths that may not be in master)
    cat_dir = os.path.join(HISTORY_DIR, category)
    if os.path.exists(cat_dir):
        for version in os.listdir(cat_dir):
            version_dir = os.path.join(cat_dir, version)
            data_file = os.path.join(version_dir, "data.csv")
            
            if os.path.exists(data_file):
                try:
                    with open(data_file, 'r', encoding='utf-8-sig') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            link = row.get("Link", "").strip()
                            if not link:
                                continue
                            
                            image_folder = row.get("ImageFolder", "").strip()
                            has_images = False
                            image_count = 0
                            
                            if image_folder and os.path.exists(image_folder):
                                try:
                                    image_count = len([f for f in os.listdir(image_folder) if f.startswith("image_")])
                                    has_images = image_count > 0
                                except:
                                    pass
                            
                            has_details = bool(
                                row.get("Description", "").strip() or 
                                row.get("OpenTime", "").strip() or
                                row.get("Email", "").strip() or
                                row.get("Website", "").strip()
                            )
                            
                            # Update if not exists or if this has more complete data
                            if link not in existing_items:
                                existing_items[link] = {
                                    "has_details": has_details,
                                    "has_images": has_images,
                                    "image_folder": image_folder,
                                    "image_count": image_count
                                }
                            else:
                                # Update with better data from history
                                if has_details and not existing_items[link]["has_details"]:
                                    existing_items[link]["has_details"] = True
                                if has_images and not existing_items[link]["has_images"]:
                                    existing_items[link]["has_images"] = True
                                    existing_items[link]["image_folder"] = image_folder
                                    existing_items[link]["image_count"] = image_count
                                    
                except Exception as e:
                    print(f"Error loading {data_file}: {e}")
    
    return existing_items

# === CRAWLING LOGIC (CONCURRENT) ===

# ... (detect_max_page kept similar) ...
async def detect_max_page(page, base_url: str, url_path: str) -> int:
    try:
        url = f"{base_url}{url_path}/?page=1"
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        
        pagination = page.locator(".pagination a, .page-link, a[href*='page=']")
        count = await pagination.count()
        max_page = 1
        
        for i in range(count):
            try:
                href = await pagination.nth(i).get_attribute("href")
                if href and "page=" in href:
                    match = re.search(r'page=(\d+)', href)
                    if match:
                        num = int(match.group(1))
                        if num > max_page: max_page = num
            except: continue
        
        last = page.locator(".pagination li:last-child a")
        if await last.count() > 0:
            href = await last.first.get_attribute("href")
            match = re.search(r'page=(\d+)', href or "")
            if match and int(match.group(1)) > max_page:
                max_page = int(match.group(1))
                
        return max_page
    except:
        return 1

async def download_image(session: aiohttp.ClientSession, url: str, folder_path: str, index: int):
    if not url or not url.startswith("http"): return
    try:
        ext = url.split('.')[-1].split('?')[0]
        if len(ext) > 4: ext = "jpg"
        filename = f"image_{index}.{ext}"
        filepath = os.path.join(folder_path, filename)
        if os.path.exists(filepath): return

        async with session.get(url, timeout=15) as resp:
            if resp.status == 200:
                with open(filepath, 'wb') as f:
                    f.write(await resp.read())
    except: pass

async def extract_details(page, config_type: str) -> Dict:
    data = {"Description": "", "OpenTime": "", "CloseTime": "", "Phone": "", "Email": "", "Website": "", "Image_Urls": []}
    try:
        # Basic extraction logic same as before...
        # Shortened for brevity in this response, but fully implemented in file
        
        open_time = page.locator('label:has-text("Giờ mở cửa")')
        if await open_time.count() > 0:
             txt = await open_time.first.inner_text()
             data["OpenTime"] = txt.split(":")[-1].strip() if ":" in txt else txt
             
        close_time = page.locator('label:has-text("Giờ đóng cửa")')
        if await close_time.count() > 0:
             txt = await close_time.first.inner_text()
             data["CloseTime"] = txt.split(":")[-1].strip() if ":" in txt else txt

        descs = await page.locator(".col-12.py-2:not(:has(label))").all_inner_texts()
        data["Description"] = "\n".join([clean_text(t) for t in descs if t.strip()])
        
        detail_box = page.locator(".cslt-detail")
        
        # Phone
        ph = detail_box.locator(".fa-phone")
        if await ph.count() > 0:
            raw = await ph.first.locator("..").inner_text()
            data["Phone"] = re.sub(r'(Điện thoại.*?|Tel|:)', '', raw).strip()
            
        # Email
        em = detail_box.locator(".fa-envelope-o")
        if await em.count() > 0:
            raw = await em.first.locator("..").inner_text()
            data["Email"] = raw.replace("Email:", "").strip()
            
        # Web
        wb = detail_box.locator(".fa-globe")
        if await wb.count() > 0:
            raw = await wb.first.locator("..").inner_text()
            data["Website"] = raw.replace("Website:", "").strip()
            
        # Images
        imgs = []
        gallery = page.locator(".col-md-12.mx-0.list-3 img")
        cnt = await gallery.count()
        for i in range(cnt):
            src = await gallery.nth(i).get_attribute("src")
            if src: imgs.append(src)
            
        if config_type == "generic":
            thumbs = page.locator(".listing-shot-img img")
            cnt = await thumbs.count()
            for i in range(cnt):
                src = await thumbs.nth(i).get_attribute("src")
                if src: imgs.append(src)
        
        data["Image_Urls"] = list(set(imgs))
        
    except Exception as e:
        print(f"Extract error: {e}")
        
    return data

async def process_detail_item(browser, semaphore, item: Dict, category: str, config_type: str, images_dir: str):
    """Process a single item detail with semaphore limit"""
    async with semaphore:
        url = item.get("Link")
        if not url or "http" not in url: return
        
        try:
            context = await browser.new_context()
            page = await context.new_page()
            
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            details = await extract_details(page, config_type)
            
            item.update(details)
            
            # Download images
            if details["Image_Urls"]:
                item_slug = slugify(item.get("Name", "unknown"))
                item_img_dir = os.path.join(images_dir, item_slug)
                os.makedirs(item_img_dir, exist_ok=True)
                
                async with aiohttp.ClientSession() as session:
                    tasks = []
                    for idx, img_url in enumerate(details["Image_Urls"]):
                         if not img_url.startswith("http"):
                             if img_url.startswith("/"): img_url = BASE_URL + img_url
                         tasks.append(download_image(session, img_url, item_img_dir, idx))
                    await asyncio.gather(*tasks)
                
                item["ImageFolder"] = item_img_dir
                item["ImageCount"] = len(details["Image_Urls"])
            
            await context.close()
            
        except Exception as e:
            print(f"Error processing {url}: {e}")

async def crawl_list_page(page, url: str, category: str) -> List[Dict]:
    items = []
    try:
        await page.goto(url, timeout=45000, wait_until="domcontentloaded")
        
        captions = page.locator(".verticle-listing-caption")
        count = await captions.count()
        
        for i in range(count):
            try:
                el = captions.nth(i)
                name_el = el.locator("h4 a")
                
                name, link = "", ""
                if await name_el.count() > 0:
                    name = await name_el.inner_text()
                    href = await name_el.get_attribute("href")
                    link = BASE_URL + href if href else ""
                
                address = ""
                addr_el = el.locator("span:has(.fa-map-marker)")
                if await addr_el.count() > 0:
                    t = await addr_el.inner_text()
                    address = remove_prefix(t, ["Địa chỉ:", "Address:"])
                    
                phone = ""
                phone_el = el.locator("span:has(.fa-phone)")
                if await phone_el.count() > 0:
                    t = await phone_el.inner_text()
                    phone = remove_prefix(t, ["Điện thoại cố định:", "Tel:", "Điện thoại:", "Điện thoại di động:"])
                
                if name:
                    items.append({
                        "Name": clean_text(name),
                        "Address": clean_text(address),
                        "Phone": clean_text(phone),
                        "Link": link
                    })
            except: continue
            
    except Exception as e:
        print(f"List page error: {e}")
        
    return items

async def run_crawl_task(categories: List[str], max_pages: Optional[int], crawl_details: bool, concurrency: int):
    global crawl_status, should_stop
    should_stop = False  # Reset stop flag
    crawl_status["is_running"] = True
    crawl_status["message"] = "Starting..."
    crawl_status["items_crawled"] = 0
    await broadcast("status", crawl_status)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if not HAS_PLAYWRIGHT:
        add_log(LogLevel.ERROR, "sys", "Playwright missing")
        return

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            
            for category in categories:
                # Check if stop was requested
                if should_stop:
                    break
                    
                if category not in CATEGORY_CONFIGS: continue
                config = CATEGORY_CONFIGS[category]
                crawl_status["current_category"] = category
                
                # Setup folders - DON'T create session_dir yet (only if we have new data)
                session_dir = os.path.join(HISTORY_DIR, category, timestamp)
                # Central images folder for all items in this category
                central_images_dir = os.path.join(IMAGES_DIR, category)
                os.makedirs(central_images_dir, exist_ok=True)
                
                # Detect pages
                context = await browser.new_context()
                page = await context.new_page()
                
                if max_pages is None:
                    add_log(LogLevel.INFO, category, "Detecting pages...")
                    await broadcast("log", crawl_status["logs"][-1])
                    detected = await detect_max_page(page, BASE_URL, config["url_path"])
                    total_pages = detected if detected > 0 else config["fallback_max_page"]
                else:
                    total_pages = max_pages
                    
                add_log(LogLevel.INFO, category, f"Crawling {total_pages} pages")
                await broadcast("log", crawl_status["logs"][-1])
                
                # Set total_pages for progress tracking
                crawl_status["total_pages"] = total_pages
                crawl_status["current_page"] = 0
                await broadcast("status", crawl_status)
                
                # Load existing items for incremental crawl (with details/images info)
                existing_items = load_existing_items(category)
                if existing_items:
                    add_log(LogLevel.INFO, category, f"Found {len(existing_items)} existing items - checking for completeness")
                    await broadcast("log", crawl_status["logs"][-1])
                
                # Crawl List Pages
                cat_items = []
                items_needing_details = []  # Items that exist but need details/images
                skipped_count = 0
                
                for p_num in range(1, total_pages + 1):
                    # Check if stop was requested
                    if should_stop:
                        add_log(LogLevel.WARNING, category, "Stopped by user")
                        break
                    
                    crawl_status["message"] = f"{category}: Page {p_num}/{total_pages}"
                    crawl_status["current_page"] = p_num
                    await broadcast("status", crawl_status)
                    
                    url = f"{BASE_URL}{config['url_path']}/?page={p_num}"
                    items = await crawl_list_page(page, url, category)
                    
                    # Filter based on existing data and crawl_details flag
                    new_items = []
                    for item in items:
                        link = item.get("Link", "").strip()
                        
                        if link and link in existing_items:
                            existing = existing_items[link]
                            
                            if crawl_details:
                                # If crawl_details is enabled, check if details AND images exist
                                if existing["has_details"] and existing["has_images"]:
                                    # Fully complete - skip this item
                                    skipped_count += 1
                                else:
                                    # Needs details or images - add to special list
                                    items_needing_details.append({
                                        **item,
                                        "_needs_details": not existing["has_details"],
                                        "_needs_images": not existing["has_images"]
                                    })
                            else:
                                # No details mode - if basic data exists, skip
                                skipped_count += 1
                        else:
                            # Completely new item
                            new_items.append(item)
                            if link:
                                existing_items[link] = {"has_details": False, "has_images": False}
                    
                    cat_items.extend(new_items)
                    crawl_status["items_crawled"] += len(new_items)
                    
                    # Log every 5 pages
                    if p_num % 5 == 0:
                        msg = f"Got {len(cat_items)} new items"
                        if crawl_details and items_needing_details:
                            msg += f", {len(items_needing_details)} need details/images"
                        msg += f" (skipped {skipped_count} complete)"
                        add_log(LogLevel.SUCCESS, category, msg)
                        await broadcast("log", crawl_status["logs"][-1])

                await context.close()
                
                # Log final incremental stats
                if skipped_count > 0 or items_needing_details:
                    msg = f"Total: {len(cat_items)} new, {skipped_count} complete (skipped)"
                    if crawl_details and items_needing_details:
                        msg += f", {len(items_needing_details)} need details/images"
                    add_log(LogLevel.INFO, category, msg)
                    await broadcast("log", crawl_status["logs"][-1])
                
                # Add items needing details to the crawl list (they'll get detail crawling)
                if crawl_details:
                    cat_items.extend(items_needing_details)
                
                # Crawl Details (Concurrent)
                if crawl_details and cat_items:
                    message_log = add_log(LogLevel.INFO, category, f"Crawling details for {len(cat_items)} items ({concurrency} threads)...")
                    await broadcast("log", message_log)
                    
                    semaphore = asyncio.Semaphore(concurrency)
                    tasks = []
                    
                    total_items = len(cat_items)
                    processed = 0
                    
                    # Chunk tasks to update progress
                    # We process all, but update UI
                    
                    async def progress_wrapper(itm):
                        nonlocal processed
                        await process_detail_item(browser, semaphore, itm, category, config["type"], central_images_dir)
                        processed += 1
                        if processed % 5 == 0:
                            crawl_status["message"] = f"{category}: Details {processed}/{total_items}"
                            await broadcast("status", crawl_status)

                    tasks = [progress_wrapper(item) for item in cat_items]
                    await asyncio.gather(*tasks)
                
                # Save Data - ONLY if we have new items
                if cat_items:
                    # Create session folder for version tracking (new samples only)
                    os.makedirs(session_dir, exist_ok=True)
                    
                    data_path = os.path.join(session_dir, "data.csv")
                    fieldnames = ["Name", "Address", "Phone", "Link"]
                    if crawl_details:
                        fieldnames.extend(["OpenTime", "CloseTime", "Description", "Email", "Website", "ImageFolder", "ImageCount"])
                    
                    # Clean internal flags before saving
                    clean_items = []
                    for item in cat_items:
                        clean_item = {k: v for k, v in item.items() if not k.startswith("_")}
                        clean_items.append(clean_item)
                    
                    with open(data_path, 'w', newline='', encoding='utf-8-sig') as f:
                        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
                        writer.writeheader()
                        writer.writerows(clean_items)
                    
                    add_log(LogLevel.SUCCESS, category, f"Saved {len(clean_items)} NEW items to history")
                    await broadcast("log", crawl_status["logs"][-1])
                    
                    # Merge into master data file (append new data, not replace)
                    if config.get("output_file"):
                        main_output = os.path.join(DATA_DIR, config["output_file"])
                        
                        # Load existing master data
                        master_items = {}
                        if os.path.exists(main_output):
                            try:
                                with open(main_output, 'r', encoding='utf-8-sig') as f:
                                    reader = csv.DictReader(f)
                                    for row in reader:
                                        link = row.get("Link", "").strip()
                                        if link:
                                            master_items[link] = row
                            except Exception as e:
                                print(f"Error reading master file: {e}")
                        
                        # Merge new items (update existing or add new)
                        for item in clean_items:
                            link = item.get("Link", "").strip()
                            if link:
                                if link in master_items:
                                    # Update existing: keep old data, override with new non-empty fields
                                    for key, value in item.items():
                                        if value:  # Only update if new value is not empty
                                            master_items[link][key] = value
                                else:
                                    master_items[link] = item
                        
                        # Write merged master file
                        with open(main_output, 'w', newline='', encoding='utf-8-sig') as f:
                            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
                            writer.writeheader()
                            writer.writerows(master_items.values())
                        
                        add_log(LogLevel.SUCCESS, category, f"Master file updated: {len(master_items)} total items")
                        await broadcast("log", crawl_status["logs"][-1])
                    
                    cleanup_old_versions(category)
                else:
                    # No new data - don't create empty folder, don't cleanup
                    add_log(LogLevel.INFO, category, f"No new data to save (all {skipped_count} items already exist)")
                    await broadcast("log", crawl_status["logs"][-1])
                    
                    # Remove empty session folder if it was created
                    if os.path.exists(session_dir) and not os.listdir(session_dir):
                        try:
                            os.rmdir(session_dir)
                        except:
                            pass
                
            await browser.close()
            
    except Exception as e:
        add_log(LogLevel.ERROR, "system", f"Fatal error: {str(e)}")
        print(f"Crawl Error: {e}")
    finally:
        crawl_status["is_running"] = False
        crawl_status["message"] = "Done"
        await broadcast("status", crawl_status)

# FastAPI App
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("AutoCrawler API v7 starting...")
    os.makedirs(HISTORY_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    yield
    if crawl_task and not crawl_task.done():
        crawl_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
async def root():
    return {"message": "AutoCrawler API v7", "status": "running"}

@app.get("/status")
async def get_status():
    return crawl_status

@app.get("/history")
async def api_get_history():
    return get_history()

@app.post("/crawl/start")
async def start_crawl(req: CrawlRequest):
    global crawl_task
    if crawl_status.get("is_running"):
        raise HTTPException(400, "In progress")
        
    cats = [c for c in req.categories if c in CATEGORY_CONFIGS]
    if not cats: raise HTTPException(400, "No valid category")
    
    concurrency = req.concurrency_limit or 5
    concurrency = min(max(1, concurrency), 10) # 1-10 limit
    
    crawl_task = asyncio.create_task(run_crawl_task(cats, req.max_pages_per_category, req.crawl_details, concurrency))
    return {"message": "Started", "concurrency": concurrency}

@app.post("/crawl/stop")
async def stop_crawl():
    global crawl_task, should_stop, crawl_status
    should_stop = True
    crawl_status["is_running"] = False
    crawl_status["message"] = "Stopping..."
    if crawl_task and not crawl_task.done():
        crawl_task.cancel()
    add_log(LogLevel.WARNING, "system", "Crawl stopped by user")
    await broadcast("status", crawl_status)
    return {"message": "Stopped"}

@app.post("/download/zip")
async def download_zip(req: BatchDownloadRequest):
    """Create a zip file from selected history sessions"""
    if not req.sessions: raise HTTPException(400, "No sessions selected")
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for sess in req.sessions:
            cat = sess.get("category")
            ts = sess.get("timestamp")
            dtype = sess.get("type", "data") # data or images
            
            path = os.path.join(HISTORY_DIR, cat, ts)
            if not os.path.exists(path): continue
            
            if dtype == "data":
                 csv_path = os.path.join(path, "data.csv")
                 if os.path.exists(csv_path):
                     zf.write(csv_path, f"{cat}_{ts}.csv")
            elif dtype == "images":
                 img_root = os.path.join(path, "images")
                 if os.path.exists(img_root):
                     for root, _, files in os.walk(img_root):
                         for file in files:
                             abs_path = os.path.join(root, file)
                             rel_path = os.path.relpath(abs_path, img_root)
                             zf.write(abs_path, f"{cat}_{ts}_images/{rel_path}")

    zip_buffer.seek(0)
    filename = f"download_{datetime.now().strftime('%H%M%S')}.zip"
    
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/categories")
async def get_cats():
    return CATEGORY_CONFIGS

@app.get("/models/gemini")
async def get_models():
    return {"models": [{"name": k, **v} for k,v in MODEL_RATE_LIMITS.items()]}

@app.get("/api-keys/dashboard")
async def dashboard():
    mem = psutil.virtual_memory()
    return {"memory": {"percent": mem.percent}, "gemini": {}, "huggingface": {}}

@app.post("/api-keys/validate")
async def validate_api_key(req: APIKeyRequest):
    """Validate an API key by making a test request"""
    import aiohttp
    
    if req.provider == "gemini":
        # Test Gemini API key with a simple request
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={req.api_key}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        return {"valid": True, "message": "Gemini API key hợp lệ"}
                    elif response.status == 400:
                        error_data = await response.json()
                        return {"valid": False, "message": error_data.get("error", {}).get("message", "Invalid API key")}
                    elif response.status == 403:
                        return {"valid": False, "message": "API key không có quyền truy cập"}
                    else:
                        return {"valid": False, "message": f"Lỗi HTTP {response.status}"}
        except asyncio.TimeoutError:
            return {"valid": False, "message": "Timeout - kiểm tra kết nối mạng"}
        except Exception as e:
            return {"valid": False, "message": str(e)}
    
    elif req.provider == "huggingface":
        # Test HuggingFace API key
        try:
            url = "https://huggingface.co/api/whoami-v2"
            headers = {"Authorization": f"Bearer {req.api_key}"}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        return {"valid": True, "message": "HuggingFace API key hợp lệ"}
                    else:
                        return {"valid": False, "message": "Invalid HuggingFace API key"}
        except Exception as e:
            return {"valid": False, "message": str(e)}
    
    return {"valid": False, "message": f"Provider không hỗ trợ: {req.provider}"}

@app.post("/api-keys/add")
async def add_api_key(req: APIKeyRequest):
    """Add API key to tracking (stored in memory for this session)"""
    # Store in memory for use by chat endpoint
    if not hasattr(app.state, 'api_keys'):
        app.state.api_keys = {}
    app.state.api_keys[req.provider] = req.api_key
    return {"success": True, "message": f"Key added for {req.provider}"}

# External Search (Fallback when DB has no results)
class ExternalSearchRequest(BaseModel):
    query: str
    api_key: Optional[str] = None

@app.post("/search/external")
async def search_external(req: ExternalSearchRequest):
    """Search for location info using Gemini when local DB returns no results.
    Returns structured data that can be used by the chatbot."""
    import aiohttp
    
    # Get API key
    api_key = req.api_key
    if not api_key and hasattr(app.state, 'api_keys') and 'gemini' in app.state.api_keys:
        api_key = app.state.api_keys['gemini']
    if not api_key:
        api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return {"error": "No Gemini API key", "locations": []}
    
    # Build prompt to extract structured location info
    prompt = f"""Bạn là chuyên gia du lịch Việt Nam. Với câu hỏi sau, hãy trả về thông tin địa điểm dưới dạng JSON.

Câu hỏi: {req.query}

Trả về JSON với format sau (CHỈ trả về JSON, không giải thích):
{{
  "locations": [
    {{
      "landmark_name": "Tên địa điểm",
      "city": "Tên thành phố/tỉnh",
      "district": "Quận/Huyện (nếu có)",
      "description": "Mô tả ngắn 2-3 câu",
      "qa_pairs": [
        {{"q": "Câu hỏi thường gặp 1?", "a": "Câu trả lời"}},
        {{"q": "Giờ mở cửa?", "a": "Thông tin giờ mở cửa nếu biết"}}
      ],
      "is_external": true
    }}
  ],
  "has_results": true/false
}}

Nếu không tìm thấy địa điểm liên quan, trả về {{"locations": [], "has_results": false}}
"""
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048}
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=30) as response:
                if response.status != 200:
                    return {"error": f"Gemini API error: {response.status}", "locations": []}
                
                result = await response.json()
                text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                # Parse JSON from response
                try:
                    # Clean up response (remove markdown code blocks if present)
                    clean_text = text.strip()
                    if clean_text.startswith("```"):
                        clean_text = clean_text.split("\n", 1)[1]  # Remove first line
                        clean_text = clean_text.rsplit("```", 1)[0]  # Remove last ```
                    
                    data = json.loads(clean_text)
                    return {
                        "locations": data.get("locations", []),
                        "has_results": data.get("has_results", len(data.get("locations", [])) > 0),
                        "source": "gemini_generated"
                    }
                except json.JSONDecodeError:
                    # If JSON parse fails, return raw text for debugging
                    return {"error": "Failed to parse Gemini response", "raw": text[:500], "locations": []}
                    
    except asyncio.TimeoutError:
        return {"error": "Search timeout", "locations": []}
    except Exception as e:
        return {"error": str(e), "locations": []}

# Emotion Detection via Gemini
class EmotionDetectRequest(BaseModel):
    messages: List[str]  # Recent messages to analyze
    api_key: Optional[str] = None

@app.post("/chat/detect-emotion")
async def detect_emotion(req: EmotionDetectRequest):
    """Detect user emotion from chat messages using Gemini.
    Returns: calm, excited, curious, frustrated, neutral"""
    import aiohttp
    
    api_key = req.api_key
    if not api_key and hasattr(app.state, 'api_keys') and 'gemini' in app.state.api_keys:
        api_key = app.state.api_keys['gemini']
    if not api_key:
        api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return {"emotion": "neutral", "confidence": 0}
    
    messages_text = "\n".join(req.messages[-5:])  # Last 5 messages
    
    prompt = f"""Phân tích cảm xúc của người dùng từ các tin nhắn sau:

{messages_text}

Trả về JSON (CHỈ JSON, không giải thích):
{{
  "emotion": "calm" | "excited" | "curious" | "frustrated" | "neutral",
  "confidence": 0.0-1.0,
  "reason": "Giải thích ngắn gọn"
}}
"""
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 256}
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=15) as response:
                if response.status != 200:
                    return {"emotion": "neutral", "confidence": 0}
                
                result = await response.json()
                text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                try:
                    clean_text = text.strip()
                    if clean_text.startswith("```"):
                        clean_text = clean_text.split("\n", 1)[1]
                        clean_text = clean_text.rsplit("```", 1)[0]
                    
                    data = json.loads(clean_text)
                    return data
                except:
                    return {"emotion": "neutral", "confidence": 0}
                    
    except:
        return {"emotion": "neutral", "confidence": 0}

# ===== NEW RAG PIPELINE =====
# Import RAG module for query rewriting and context management
try:
    from rag import rewrite_query, is_affirmative, process_rag_query
    from rag.memory import ConversationSummaryBufferMemory
    HAS_RAG_MODULE = True
    print("✅ RAG module loaded successfully")
except ImportError as e:
    HAS_RAG_MODULE = False
    print(f"⚠️ RAG module not loaded: {e}")

# Session-based memory manager (per conversation)
session_memories: Dict[str, Any] = {}

def get_session_memory(session_id: str, api_key: str = None) -> Any:
    """Get or create memory for a session"""
    if not HAS_RAG_MODULE:
        return None
    
    if session_id not in session_memories:
        session_memories[session_id] = ConversationSummaryBufferMemory(
            api_key=api_key,
            buffer_size=4,  # Keep last 4 raw messages
            summary_threshold=8  # Summarize when > 8 messages
        )
        print(f"📝 Created new memory for session: {session_id[:8]}...")
    
    return session_memories[session_id]

class RAGRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = []  # [{role, content}, ...]
    session_id: Optional[str] = None  # Session ID for memory management
    api_key: Optional[str] = None

@app.post("/rag/process")
async def process_rag(req: RAGRequest):
    """
    New RAG pipeline with Query Rewriting + Session Memory.
    
    Flow:
    1. Load/create session memory (SummaryBufferMemory)
    2. Add current message to memory
    3. Detect if query is affirmative/short follow-up
    4. Rewrite query using memory context
    5. Return rewritten query + memory context
    """
    if not HAS_RAG_MODULE:
        return {
            "original_query": req.query,
            "rewritten_query": req.query,
            "skip_retrieval": False,
            "error": "RAG module not available"
        }
    
    # Get API key
    api_key = req.api_key
    if not api_key and hasattr(app.state, 'api_keys') and 'gemini' in app.state.api_keys:
        api_key = app.state.api_keys['gemini']
    if not api_key:
        api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return {
            "original_query": req.query,
            "rewritten_query": req.query,
            "skip_retrieval": False,
            "error": "No API key"
        }
    
    # Get or create session memory
    memory = None
    memory_context = ""
    if req.session_id:
        memory = get_session_memory(req.session_id, api_key)
        if memory:
            # Add user message to memory
            memory.add_message("user", req.query)
            # Get context from memory (includes summary + buffer + entities)
            memory_context = memory.get_context_for_prompt()
            print(f"📝 Memory context: topic={memory.current_topic}, entities={list(memory.entities.keys())[:3]}")
    
    # Process through RAG pipeline
    try:
        result = await process_rag_query(
            query=req.query,
            history=req.history,
            api_key=api_key
        )
        
        # Add memory context to result
        result["memory_context"] = memory_context
        result["current_topic"] = memory.current_topic if memory else None
        result["entities"] = list(memory.entities.keys()) if memory else []
        
        return result
    except Exception as e:
        print(f"RAG process error: {e}")
        return {
            "original_query": req.query,
            "rewritten_query": req.query,
            "skip_retrieval": False,
            "memory_context": memory_context,
            "error": str(e)
        }

class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gemini-2.5-flash"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024
    api_key: Optional[str] = None  # API key passed from frontend
    image_urls: Optional[List[str]] = None  # For multimodal (Vision) requests

# Model mapping - use actual available model names
GEMINI_MODELS = {
    "gemini-2.5-flash": "gemini-2.0-flash",  
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-1.5-pro": "gemini-1.5-pro",
}

@app.post("/chat/generate")
async def chat_generate(req: ChatRequest):
    """Generate chat response using Gemini API (supports multimodal with images)"""
    import aiohttp
    import base64
    
    # Get API key from request, then memory, then environment
    api_key = req.api_key
    
    if not api_key and hasattr(app.state, 'api_keys') and 'gemini' in app.state.api_keys:
        api_key = app.state.api_keys['gemini']
    
    if not api_key:
        api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return {"error": "No Gemini API key configured. Please add one in Settings or set GEMINI_API_KEY environment variable."}
    
    # Map model name
    model_id = GEMINI_MODELS.get(req.model, req.model)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    
    # Build content parts - text first
    parts = [{"text": req.prompt}]
    
    # Add images if present (multimodal/Vision request)
    if req.image_urls and len(req.image_urls) > 0:
        print(f"Processing {len(req.image_urls)} images for Vision API...")
        
        for img_url in req.image_urls[:3]:  # Limit to 3 images
            try:
                # Handle base64 data URLs (from frontend fallback when storage fails)
                if img_url.startswith('data:'):
                    # Parse data URL: data:image/png;base64,iVBORw0...
                    try:
                        header, data = img_url.split(',', 1)
                        # Extract mime type from header like "data:image/png;base64"
                        mime_part = header.split(':')[1].split(';')[0]
                        mime_type = mime_part if mime_part else 'image/png'
                        
                        parts.append({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": data  # Already base64 encoded
                            }
                        })
                        print(f"Added base64 image: {mime_type} ({len(data)} chars)")
                    except Exception as e:
                        print(f"Failed to parse data URL: {e}")
                        
                # Handle HTTP/HTTPS URLs (fetch and convert to base64)
                elif img_url.startswith('http://') or img_url.startswith('https://'):
                    async with aiohttp.ClientSession() as session:
                        async with session.get(img_url, timeout=15) as img_response:
                            if img_response.status == 200:
                                img_data = await img_response.read()
                                img_base64 = base64.b64encode(img_data).decode('utf-8')
                                
                                # Detect mime type from content-type header or URL
                                content_type = img_response.headers.get('content-type', 'image/jpeg')
                                if 'png' in content_type or img_url.endswith('.png'):
                                    mime_type = 'image/png'
                                elif 'gif' in content_type or img_url.endswith('.gif'):
                                    mime_type = 'image/gif'
                                elif 'webp' in content_type or img_url.endswith('.webp'):
                                    mime_type = 'image/webp'
                                else:
                                    mime_type = 'image/jpeg'
                                
                                parts.append({
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": img_base64
                                    }
                                })
                                print(f"Added HTTP image: {img_url[:50]}... ({mime_type})")
                else:
                    print(f"Unknown image URL format: {img_url[:30]}...")
                    
            except Exception as e:
                print(f"Failed to process image: {e}")
    
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": req.temperature,
            "maxOutputTokens": req.max_tokens,
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=60) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Gemini API error: {error_text}")
                    return {"error": f"Gemini API error: {response.status}"}
                
                result = await response.json()
                text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                return {
                    "text": text,
                    "model": model_id,
                    "usage": result.get("usageMetadata", {}),
                    "has_images": len(req.image_urls or []) > 0
                }
    except asyncio.TimeoutError:
        return {"error": "Request timeout - please try again"}
    except Exception as e:
        print(f"Chat generate error: {e}")
        return {"error": str(e)}

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        if websocket in active_connections:
            active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
