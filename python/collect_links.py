"""
Copyright 2018 YoongiKim

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
"""

import time
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.common.exceptions import StaleElementReferenceException, NoSuchElementException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


class CollectLinks:
    def __init__(self, no_gui=False, proxy=None):
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')  # To maintain user cookies
        chrome_options.add_argument('--disable-dev-shm-usage')
        if no_gui:
            chrome_options.add_argument('--headless')
        if proxy:
            chrome_options.add_argument("--proxy-server={}".format(proxy))
        self.browser = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

        browser_version = 'Failed to detect version'
        chromedriver_version = 'Failed to detect version'
        major_version_different = False

        if 'browserVersion' in self.browser.capabilities:
            browser_version = str(self.browser.capabilities['browserVersion'])

        if 'chrome' in self.browser.capabilities:
            if 'chromedriverVersion' in self.browser.capabilities['chrome']:
                chromedriver_version = str(self.browser.capabilities['chrome']['chromedriverVersion']).split(' ')[0]

        if browser_version.split('.')[0] != chromedriver_version.split('.')[0]:
            major_version_different = True

        print('_________________________________')
        print('Current web-browser version:\t{}'.format(browser_version))
        print('Current chrome-driver version:\t{}'.format(chromedriver_version))
        if major_version_different:
            print('warning: Version different')
            print(
                'Download correct version at "http://chromedriver.chromium.org/downloads" and place in "./chromedriver"')
        print('_________________________________')

    def get_scroll(self):
        pos = self.browser.execute_script("return window.pageYOffset;")
        return pos

    def wait_and_click(self, xpath):
        #  Sometimes click fails unreasonably. So tries to click at all cost.
        try:
            w = WebDriverWait(self.browser, 15)
            elem = w.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            elem.click()
            self.highlight(elem)
        except Exception as e:
            print('Click time out - {}'.format(xpath))
            print('Refreshing browser...')
            self.browser.refresh()
            time.sleep(2)
            return self.wait_and_click(xpath)

        return elem

    def highlight(self, element):
        self.browser.execute_script("arguments[0].setAttribute('style', arguments[1]);", element,
                                    "background: yellow; border: 2px solid red;")

    @staticmethod
    def get_text_or_none(browser, xpath):
        try:
            # Tìm phần tử và trả về nội dung text, loại bỏ các ký tự dấu phân cách không cần thiết
            element = browser.find_element(By.XPATH, xpath)
            text_content = element.text.replace('\xa0', ' ').strip()
            
            # Nếu chỉ là label, cố gắng tìm text tiếp theo
            if text_content.startswith('Người tạo:') or text_content.startswith('Tác giả:') or text_content.startswith('Bản quyền:'):
                # Google thường đặt nội dung ngay sau label hoặc trong thẻ span kế tiếp. 
                # Nếu chỉ là label, trả về None để gọi fallback
                if text_content.endswith(':'): 
                    return None 
            
            return text_content
            
        except NoSuchElementException:
            return None
        except Exception:
            return None

    @staticmethod
    def get_license_info(browser, license_block):
        # Hàm hỗ trợ trích xuất thông tin bản quyền và tác giả từ khối license
        creator_name = 'none'
        author_name = 'none'
        copyright_statement = 'none'

        try:
            # 1. Creator (Người tạo) - Tìm trong khối chứa "Người tạo"
            try:
                creator_xpath = './/span[contains(text(), "Người tạo:")]/following-sibling::span | .//span[contains(text(), "Người tạo:")]'
                creator_element = license_block.find_element(By.XPATH, creator_xpath)
                creator_text = creator_element.text.replace('Người tạo:', '').strip()
                if creator_text:
                    creator_name = creator_text
            except:
                pass

            # 2. Author (Tác giả) - Tìm trong khối chứa "Tác giả"
            try:
                author_xpath = './/span[contains(text(), "Tác giả:")]/following-sibling::span | .//span[contains(text(), "Tác giả:")]'
                author_element = license_block.find_element(By.XPATH, author_xpath)
                author_text = author_element.text.replace('Tác giả:', '').strip()
                if author_text and author_text != creator_name: # Tránh trùng lặp nếu tác giả và người tạo là một
                    author_name = author_text
            except:
                pass
            
            # 3. Copyright (Bản quyền) - Tìm trong khối chứa "Bản quyền" hoặc class cụ thể
            try:
                copyright_xpath = './/span[contains(text(), "Bản quyền:")]/following-sibling::span | .//span[contains(text(), "Bản quyền:")]'
                copyright_element = license_block.find_element(By.XPATH, copyright_xpath)
                copyright_text = copyright_element.text.replace('Bản quyền:', '').strip()
                if copyright_text:
                    copyright_statement = copyright_text
            except:
                pass

        except Exception as e:
            # print(f"Error extracting license info: {e}")
            pass

        return creator_name, author_name, copyright_statement


    @staticmethod
    def remove_duplicates(_list):
        return list(dict.fromkeys(_list))

    # Hỗ trợ loại bỏ trùng lặp cho danh sách dictionary
    @staticmethod
    def remove_duplicates_dict(data_list):
        seen = set()
        new_list = []
        for d in data_list:
            # Tạo tuple từ các giá trị để có thể hash
            # Chỉ sử dụng image_url và page_url để kiểm tra trùng lặp
            t = tuple(sorted([(k, v) for k, v in d.items() if k in ['image_url', 'page_url']]))
            if t not in seen:
                seen.add(t)
                new_list.append(d)
        return new_list

    def google(self, keyword, add_url="", max_count=0):
        # add_url bây giờ bao gồm cả filter khu vực và license (nếu có)
        self.browser.get("https://www.google.com/search?q={}&source=lnms&tbm=isch{}".format(keyword, add_url))

        time.sleep(1)

        print('Scrolling down')

        elem = self.browser.find_element(By.TAG_NAME, "body")

        last_scroll = 0
        scroll_patience = 0
        NUM_MAX_SCROLL_PATIENCE = 50

        while True:
            elem.send_keys(Keys.PAGE_DOWN)
            time.sleep(0.2)

            scroll = self.get_scroll()
            if scroll == last_scroll:
                scroll_patience += 1
            else:
                scroll_patience = 0
                last_scroll = scroll
            
            # Kiểm tra số lượng đã thu thập để dừng cuộn sớm
            if max_count > 0 and len(self.browser.find_elements(By.XPATH, '//div[@jsname="dTDiAc"]')) >= max_count:
                break

            if scroll_patience >= NUM_MAX_SCROLL_PATIENCE:
                break

        print('Scraping links')

        # Dựa trên cấu trúc HTML, chúng ta sẽ tìm kiếm container cha chứa data-lpage
        image_containers = self.browser.find_elements(By.XPATH, '//div[@jsname="dTDiAc"]')

        results = []
        for idx, container in enumerate(image_containers):
            # Không thể lấy thông tin bản quyền ở chế độ thumbnail
            creator_name = 'none (thumbnail)'
            author_name = 'none (thumbnail)'
            copyright_statement = 'none (thumbnail)'

            try:
                # 1. Lấy link bài viết (Page URL) từ thuộc tính data-lpage của container
                page_link = container.get_attribute("data-lpage")

                # 2. Tìm thẻ <img> bên trong container hiện tại
                img_element = container.find_element(By.XPATH, './/img')
                
                # 3. Lấy link ảnh trực tiếp (Image URL) từ thuộc tính src của thẻ <img>
                image_link = img_element.get_attribute("src")

                # Bỏ qua nếu không có link ảnh hoặc link bài viết
                if page_link and image_link:
                    results.append({
                        "image_url": image_link,
                        "page_url": page_link,
                        "creator_name": creator_name,
                        "author_name": author_name,
                        "copyright_statement": copyright_statement,
                    })
                    
                    # Dừng thu thập link nếu đạt max_count
                    if max_count > 0 and len(results) >= max_count:
                        break

            except NoSuchElementException:
                continue
            except Exception as e:
                print(f'[Exception occurred while collecting links from google] {e}')

        results = self.remove_duplicates_dict(results)

        print('Collect links done. Site: {}, Keyword: {}, Total: {}'.format('google', keyword, len(results)))
        self.browser.close()

        return results

    
    def naver(self, keyword, add_url="", max_count=0): # Thêm max_count
        self.browser.get(
            "https://search.naver.com/search.naver?where=image&sm=tab_jum&query={}{}".format(keyword, add_url))

        time.sleep(1)

        print('Scrolling down')

        elem = self.browser.find_element(By.TAG_NAME, "body")

        for i in range(60):
            elem.send_keys(Keys.PAGE_DOWN)
            time.sleep(0.2)

        imgs = self.browser.find_elements(By.XPATH, '//div[@class="tile_item _fe_image_tab_content_tile"]//img[@class="_fe_image_tab_content_thumbnail_image"]')

        print('Scraping links')

        links = []

        for img in imgs:
            try:
                src = img.get_attribute("src")
                if src and src[0] != 'd':
                    # Không rõ cách lấy page_url/license cho naver, tạm thời đặt là None
                    links.append({
                        "image_url": src, 
                        "page_url": None,
                        "creator_name": 'none (naver)',
                        "author_name": 'none (naver)',
                        "copyright_statement": 'none (naver)',
                    }) 
                    
                    # Dừng thu thập link nếu đạt max_count
                    if max_count > 0 and len(links) >= max_count:
                        break
                        
            except Exception as e:
                print('[Exception occurred while collecting links from naver] {}'.format(e))

        links = self.remove_duplicates_dict(links) 

        print('Collect links done. Site: {}, Keyword: {}, Total: {}'.format('naver', keyword, len(links)))
        self.browser.close()

        return links

    def google_full(self, keyword, add_url="", max_count=100): # Đổi tên limit thành max_count
        print('[Full Resolution Mode]')

        self.browser.get("https://www.google.com/search?q={}&tbm=isch{}".format(keyword, add_url))
        time.sleep(1)

        # Click the first image to get full resolution images
        self.wait_and_click('//div[@jsname="dTDiAc"]')
        time.sleep(1)

        body = self.browser.find_element(By.TAG_NAME, "body")

        print('Scraping links')

        results = [] # Lưu trữ dictionary {image_url, page_url, license_info}
        links_only = [] # Để kiểm tra tính duy nhất của image_url
        limit_count = 10000 if max_count == 0 else max_count 
        count = 1
        last_scroll = 0
        scroll_patience = 0
        NUM_MAX_SCROLL_PATIENCE = 100

        while len(results) < limit_count: # Dùng limit_count để giới hạn số link thu thập
            try:
                # 1. Tìm ảnh độ phân giải đầy đủ (Image URL)
                xpath_img = '//div[@jsname="figiqf"]//img[not(contains(@src,"gstatic.com"))]'
                
                t1 = time.time()
                while True:
                    imgs = body.find_elements(By.XPATH, xpath_img)
                    t2 = time.time()
                    if len(imgs) > 0:
                        break
                    if t2 - t1 > 5:
                        print(f"Failed to locate image by XPATH: {xpath_img}")
                        break
                    time.sleep(0.1)

                if len(imgs) > 0:
                    img_element = imgs[0]
                    self.highlight(img_element)
                    image_link = img_element.get_attribute('src')
                    
                    # 2. Tìm Page URL và License Info
                    page_link = None
                    
                    # Trích xuất Page Link (dựa trên cấu trúc mới nhất: div.h11UTe)
                    try:
                        xpath_page_link = '//div[@class="h11UTe"]/a[1]'
                        page_link_element = self.browser.find_element(By.XPATH, xpath_page_link)
                        page_link = page_link_element.get_attribute('href')
                        
                        if not page_link: 
                             xpath_page_link_fallback = '//div[@class="h11UTe"]/a[2]'
                             page_link_element = self.browser.find_element(By.XPATH, xpath_page_link_fallback)
                             page_link = page_link_element.get_attribute('href')
                             
                    except NoSuchElementException:
                        pass 
                        
                    # Trích xuất License Info (dựa trên cấu trúc mới nhất: div.Yx2mie)
                    creator_name = 'none'
                    author_name = 'none'
                    copyright_statement = 'none'
                    try:
                        license_block = body.find_element(By.XPATH, '//div[@class="Yx2mie EwDHG dJV9Pc cS4Vcb-pGL6qe-k1Ncfe"]')
                        creator_name, author_name, copyright_statement = self.get_license_info(self.browser, license_block)
                        
                    except NoSuchElementException:
                        pass
                        
                        
                    if image_link is not None and image_link not in links_only:
                        links_only.append(image_link)
                        
                        results.append({
                            "image_url": image_link,
                            "page_url": page_link,
                            "creator_name": creator_name if creator_name != 'none' else 'page', # Fallback to page if none found
                            "author_name": author_name,
                            "copyright_statement": copyright_statement,
                        })
                        
                        print('%d: %s' % (count, image_link))
                        count += 1
                        
            except KeyboardInterrupt:
                break
                
            except StaleElementReferenceException:
                pass
            except Exception as e:
                print('[Exception occurred while collecting links from google_full] {}'.format(e))

            # Logic cuộn (chuyển sang ảnh tiếp theo)
            scroll = self.get_scroll()
            if scroll == last_scroll:
                scroll_patience += 1
            else:
                scroll_patience = 0
                last_scroll = scroll

            if scroll_patience >= NUM_MAX_SCROLL_PATIENCE:
                break

            body.send_keys(Keys.RIGHT)

        results = self.remove_duplicates_dict(results) # Loại bỏ trùng lặp

        print('Collect links done. Site: {}, Keyword: {}, Total: {}'.format('google_full', keyword, len(results)))
        self.browser.close()

        return results # Trả về danh sách dictionaries

    def naver_full(self, keyword, add_url="", max_count=0): # Thêm max_count
        print('[Full Resolution Mode]')
        print('[Warning] naver_full is not modified to extract page_url or license info easily. Only image_url is returned.')


        self.browser.get(
            "https://search.naver.com/search.naver?where=image&sm=tab_jum&query={}{}".format(keyword, add_url))
        time.sleep(1)

        elem = self.browser.find_element(By.TAG_NAME, "body")

        print('Scraping links')

        # Click the first image
        self.wait_and_click('//div[@class="tile_item _fe_image_tab_content_tile"]//img[@class="_fe_image_tab_content_thumbnail_image"]')
        time.sleep(1)

        links = []
        count = 1

        last_scroll = 0
        scroll_patience = 0

        while True:
            try:
                xpath = '//img[@class="_fe_image_viewer_image_fallback_target"]'
                imgs = self.browser.find_elements(By.XPATH, xpath)

                for img in imgs:
                    self.highlight(img)
                    src = img.get_attribute('src')

                    if src not in links and src is not None:
                        links.append(src)
                        print('%d: %s' % (count, src))
                        count += 1
                        
                    # Dừng thu thập link nếu đạt max_count
                    if max_count > 0 and len(links) >= max_count:
                        break
                
                # Kiểm tra lại sau khi vòng lặp kết thúc
                if max_count > 0 and len(links) >= max_count:
                    break


            except StaleElementReferenceException:
                pass
            except Exception as e:
                print('[Exception occurred while collecting links from naver_full] {}'.format(e))

            scroll = self.get_scroll()
            if scroll == last_scroll:
                scroll_patience += 1
            else:
                scroll_patience = 0
                last_scroll = scroll

            if scroll_patience >= 100:
                break

            elem.send_keys(Keys.RIGHT)

        links = self.remove_duplicates(links)
        
        # Chuyển đổi sang định dạng dictionary để phù hợp với hàm download_images mới
        final_links = [{
            "image_url": link, 
            "page_url": None,
            "creator_name": 'none (naver)',
            "author_name": 'none (naver)',
            "copyright_statement": 'none (naver)',
        } for link in links]

        print('Collect links done. Site: {}, Keyword: {}, Total: {}'.format('naver_full', keyword, len(final_links)))
        self.browser.close()

        return final_links