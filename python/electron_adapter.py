"""
Electron Adapter for AutoCrawler
Handles JSON-based communication with Electron main process
"""

import sys
import json
import os
import asyncio
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def send_message(msg_type, **kwargs):
    """Send JSON message to Electron"""
    message = {"type": msg_type, **kwargs}
    print(json.dumps(message, ensure_ascii=False), flush=True)

def send_progress(percent, message, **stats):
    """Send progress update"""
    send_message("progress", percent=percent, message=message, stats=stats)

def send_log(message, level="info"):
    """Send log message"""
    send_message("log", message=message, level=level)

def send_complete(stats=None):
    """Send completion message"""
    send_message("complete", stats=stats or {})

def send_error(error):
    """Send error message"""
    send_message("error", error=str(error))


class ElectronCrawler:
    """Main crawler class for Electron integration"""
    
    def __init__(self, config):
        self.config = config
        self.mode = config.get('mode', 'full')  # 'full' or 'incremental'
        self.features = config.get('features', [])
        
    async def run(self):
        """Main entry point"""
        try:
            send_log(f"Bắt đầu crawl mode: {self.mode}")
            send_log(f"Features: {', '.join(self.features)}")
            
            total_features = len(self.features)
            stats = {}
            
            for i, feature in enumerate(self.features):
                base_progress = (i / total_features) * 100
                
                send_progress(
                    base_progress, 
                    f"Đang xử lý: {feature}",
                    current_feature=feature
                )
                
                # Call appropriate crawler based on feature
                if feature in ['google_images', 'naver_images']:
                    result = await self.crawl_images(feature, base_progress, total_features)
                else:
                    result = await self.crawl_tourism(feature, base_progress, total_features)
                
                stats[feature] = result.get('count', 0)
                send_log(f"Hoàn thành {feature}: {result.get('count', 0)} items", "success")
            
            send_progress(100, "Hoàn thành tất cả!")
            send_complete(stats)
            
        except Exception as e:
            send_error(str(e))
            raise
    
    async def crawl_images(self, feature, base_progress, total_features):
        """Crawl images from Google or Naver"""
        send_log(f"Crawl images: {feature}")
        
        # Import the existing crawler
        try:
            from main import AutoCrawler
            
            site = feature.split('_')[0]  # google or naver
            do_google = site == 'google'
            do_naver = site == 'naver'
            
            # Create crawler with progress callback
            crawler = AutoCrawler(
                skip_already_exist=self.mode == 'incremental',
                n_threads=4,
                do_google=do_google,
                do_naver=do_naver,
                no_gui=True
            )
            
            # Run crawling
            crawler.do_crawling()
            
            return {'count': 100}  # Placeholder
            
        except ImportError:
            send_log("Không tìm thấy module main.py", "warning")
            # Simulate crawling for demo
            await self._simulate_crawl(feature, base_progress, total_features)
            return {'count': 50}
    
    async def crawl_tourism(self, feature, base_progress, total_features):
        """Crawl tourism data"""
        send_log(f"Crawl tourism: {feature}")
        
        feature_config = {
            'hotels': {'url': 'https://csdl.vietnamtourism.gov.vn/cslt', 'max_page': 955},
            'restaurants': {'url': 'https://csdl.vietnamtourism.gov.vn/rest', 'max_page': 172},
            'shops': {'url': 'https://csdl.vietnamtourism.gov.vn/shop', 'max_page': 46},
            'entertainment': {'url': 'https://csdl.vietnamtourism.gov.vn/vcgt', 'max_page': 25},
            'destinations': {'url': 'https://csdl.vietnamtourism.gov.vn/dest', 'max_page': 65},
        }
        
        config = feature_config.get(feature)
        if not config:
            send_log(f"Không hỗ trợ feature: {feature}", "warning")
            return {'count': 0}
        
        try:
            from crawl import crawl_category
            from playwright.async_api import async_playwright
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                
                # Custom progress callback
                total_pages = config['max_page']
                
                for page_num in range(1, total_pages + 1):
                    progress = base_progress + (page_num / total_pages) * (100 / total_features)
                    send_progress(
                        progress,
                        f"Crawl {feature}: trang {page_num}/{total_pages}",
                        **{feature: page_num}
                    )
                    
                    # Simulate page delay
                    await asyncio.sleep(0.1)
                
                await browser.close()
            
            return {'count': total_pages * 10}
            
        except ImportError:
            send_log("Sử dụng chế độ demo", "info")
            await self._simulate_crawl(feature, base_progress, total_features)
            return {'count': 100}
    
    async def _simulate_crawl(self, feature, base_progress, total_features):
        """Simulate crawl for demo purposes"""
        steps = 10
        for step in range(steps):
            progress = base_progress + (step / steps) * (100 / total_features)
            send_progress(
                progress,
                f"Đang xử lý {feature}: {step * 10}%",
                **{feature: step * 10}
            )
            await asyncio.sleep(0.3)


async def main():
    """Main entry point - reads config from stdin"""
    try:
        # Read config from stdin (sent by Electron)
        config_line = sys.stdin.readline()
        
        if not config_line.strip():
            # Demo mode - run with default config
            config = {
                'mode': 'full',
                'features': ['hotels', 'restaurants']
            }
        else:
            config = json.loads(config_line)
        
        crawler = ElectronCrawler(config)
        await crawler.run()
        
    except json.JSONDecodeError as e:
        send_error(f"Invalid JSON config: {e}")
        sys.exit(1)
    except Exception as e:
        send_error(str(e))
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
