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
   limitations under the License to the specific language governing permissions and
   limitations under the License.
"""

import os
import requests
import shutil
from multiprocessing import Pool
import signal
import argparse
from collect_links import CollectLinks
import imghdr
import base64
from pathlib import Path
import random
import json
import re
from unidecode import unidecode
from functools import partial


class Sites:
    GOOGLE = 1
    NAVER = 2
    GOOGLE_FULL = 3
    NAVER_FULL = 4

    @staticmethod
    def get_text(code):
        if code == Sites.GOOGLE:
            return 'google'
        elif code == Sites.NAVER:
            return 'naver'
        elif code == Sites.GOOGLE_FULL:
            return 'google_full' 
        elif code == Sites.NAVER_FULL:
            return 'naver_full' 

    @staticmethod
    def get_face_url(code):
        # Bộ lọc khuôn mặt (áp dụng cho cả Google/Naver, mặc dù Naver ít hiệu quả)
        if code in [Sites.GOOGLE, Sites.GOOGLE_FULL]:
            return "&tbs=itp:face"
        # Naver không dùng tham số &face=1
        return ""


class AutoCrawler:
    def __init__(self, skip_already_exist=True, n_threads=4, do_google=True, do_naver=True, download_path='download',
                 full_resolution=False, face=False, no_gui=False, limit=0, proxy_list=None):
        
        self.skip = skip_already_exist
        self.n_threads = n_threads
        self.do_google = do_google
        self.do_naver = do_naver
        self.download_path = download_path
        self.full_resolution = full_resolution
        self.face = face
        self.no_gui = no_gui
        self.limit = limit
        self.proxy_list = proxy_list if proxy_list and len(proxy_list) > 0 else None
        
        # Định nghĩa 3 loại filter Google (bao gồm cả mặc định)
        self.google_filters = [
            {'name': 'cc', 'url_suffix': '&tbs=sur:fc'},  # Creative Commons
            {'name': 'commercial', 'url_suffix': '&tbs=sur:ol'},  # Commercial & other
            {'name': 'default', 'url_suffix': ''},   
        ]
        # Bộ lọc khu vực Việt Nam mặc định cho Google Images
        self.country_filter = "&cr=countryVN"

        os.makedirs('./{}'.format(self.download_path), exist_ok=True)
        
        # Khởi tạo hoặc đọc file source.json
        self.source_file_path = os.path.join(self.download_path, 'source.json')
        self.source_data = [] # Khởi tạo là list rỗng
        self._load_source_data()

    def _load_source_data(self):
        # Tải dữ liệu source.json vào bộ nhớ
        self.source_data = []
        if os.path.exists(self.source_file_path):
            try:
                with open(self.source_file_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        self.source_data = json.loads(content)
                    else:
                        print(f"Warning: {self.source_file_path} is empty. Starting with an empty list.")
            except json.JSONDecodeError:
                print(f"Warning: {self.source_file_path} is corrupted. Starting with an empty list.")
            except Exception as e:
                 print(f"Error loading {self.source_file_path}: {e}. Starting with an empty list.")


    @staticmethod
    def all_dirs(path):
        paths = []
        for dir in os.listdir(path):
            # Cần kiểm tra là thư mục, và không phải là thư mục download root
            full_path = os.path.join(path, dir)
            if os.path.isdir(full_path):
                paths.append(full_path)

        return paths

    @staticmethod
    def all_files(path):
        paths = []
        for root, dirs, files in os.walk(path):
            for file in files:
                if os.path.isfile(os.path.join(root, file)):
                    paths.append(os.path.join(root, file))

        return paths

    @staticmethod
    def get_extension_from_link(link, default='jpg'):
        splits = str(link).split('.')
        if len(splits) == 0:
            return default
        ext = splits[-1].lower()
        if ext == 'jpg' or ext == 'jpeg':
            return 'jpg'
        elif ext == 'gif':
            return 'gif'
        elif ext == 'png':
            return 'png'
        elif ext == 'webp': 
            return 'webp'
        else:
            return default

    @staticmethod
    def validate_image(path):
        ext = imghdr.what(path)
        if ext == 'jpeg':
            ext = 'jpg'
        return ext  # returns None if not valid

    @staticmethod
    def make_dir(dirname):
        current_path = os.getcwd()
        path = os.path.join(current_path, dirname)
        if not os.path.exists(path):
            os.makedirs(path)

    @staticmethod
    def get_keywords(keywords_file='keywords.txt'):
        # read search keywords from file
        with open(keywords_file, 'r', encoding='utf-8-sig') as f:
            text = f.read()
            lines = text.split('\n')
            lines = filter(lambda x: x != '' and x is not None, lines)
            keywords = sorted(set(lines))

        print('{} keywords found: {}'.format(len(keywords), keywords))

        # re-save sorted keywords
        with open(keywords_file, 'w+', encoding='utf-8') as f:
            for keyword in keywords:
                f.write('{}\n'.format(keyword))

        return keywords
    
    @staticmethod
    def save_object_to_file(object, file_path, is_base64=False):
        try:
            with open('{}'.format(file_path), 'wb') as file:
                if is_base64:
                    file.write(object)
                else:
                    shutil.copyfileobj(object.raw, file)
        except Exception as e:
            print('Save failed - {}'.format(e))

    @staticmethod
    def base64_to_object(src):
        header, encoded = str(src).split(',', 1)
        data = base64.decodebytes(bytes(encoded, encoding='utf-8'))
        return data
        
    @staticmethod
    def normalize_keyword_for_filename(keyword):
        # 0. Loại bỏ "Việt Nam" (không phân biệt hoa/thường) và khoảng trắng dư thừa
        keyword = re.sub(r'việt nam', '', keyword, flags=re.IGNORECASE).strip()
        # 1. Chuyển tiếng Việt có dấu thành không dấu
        normalized = unidecode(keyword)
        # 2. Thay thế khoảng trắng và các ký tự đặc biệt khác (ngoại trừ dấu gạch dưới và dấu chấm) bằng dấu gạch dưới
        normalized = re.sub(r'[^\w\-_\.]', '_', normalized).strip('_')
        # 3. Loại bỏ các dấu gạch dưới lặp lại
        normalized = re.sub(r'__+', '_', normalized)
        return normalized

    def download_images(self, keyword, links_data, site_name, max_count=0, current_total_files=0):
        # links_data là danh sách các dictionaries
        # max_count là số lượng ảnh CẦN download thêm (remaining_to_download)
        
        normalized_keyword = self.normalize_keyword_for_filename(keyword)
        folder_keyword_normalized = normalized_keyword # Tên thư mục dùng keyword đã chuẩn hóa

        self.make_dir('{}/{}'.format(self.download_path, folder_keyword_normalized))
        
        # Danh sách metadata mới sẽ được trả về
        new_metadata_list = []
        success_count = 0
        
        # current_total_files là số file đã có TRƯỚC khi thread này chạy.
        # Chúng ta dùng nó để tính index.
        current_file_index_start = current_total_files
        
        total = len(links_data)
        
        # Nếu max_count = 0 (tức limit vô hạn), tải hết links_data
        limit_download_in_thread = max_count if max_count > 0 else total

        for index, data in enumerate(links_data):
            # Kiểm tra nếu đã đạt giới hạn cần tải trong thread này
            if success_count >= limit_download_in_thread:
                break
                
            link = data.get("image_url")
            page_link = data.get("page_url")
            creator_name = data.get("creator_name")
            author_name = data.get("author_name")
            copyright_statement = data.get("copyright_statement")


            if link is None:
                continue

            try:
                # Index cho file mới: index_start + số_lượng_đã_tải_thành_công + 1
                file_index = current_file_index_start + success_count + 1
                filename_base = '{}_{}'.format(normalized_keyword, str(file_index).zfill(4))

                print('Downloading {} from {}: {} / {} (Total target: {})'.format(
                    keyword, site_name, success_count + 1, limit_download_in_thread, self.limit))


                is_base64 = False
                if str(link).startswith('data:image/jpeg;base64'):
                    response = self.base64_to_object(link)
                    ext = 'jpg'
                    is_base64 = True
                elif str(link).startswith('data:image/png;base64'):
                    response = self.base64_to_object(link)
                    ext = 'png'
                    is_base64 = True
                else:
                    # Randomly choose proxy for requests.get
                    proxy_config = {}
                    if self.proxy_list:
                        proxy_url = random.choice(self.proxy_list)
                        proxy_config = {'http': proxy_url, 'https': proxy_url}
                        
                    response = requests.get(link, stream=True, timeout=10, proxies=proxy_config)
                    ext = self.get_extension_from_link(link)
                    is_base64 = False

                # Đường dẫn lưu file
                download_root = self.download_path.replace('"', '')
                no_ext_path = os.path.join(download_root, folder_keyword_normalized, filename_base)
                path = no_ext_path + '.' + ext
                self.save_object_to_file(response, path, is_base64=is_base64)

                success_count += 1
                del response

                ext2 = self.validate_image(path)
                if ext2 is None:
                    print('Unreadable file - {}'.format(link))
                    os.remove(path)
                    success_count -= 1
                else:
                    current_filename_base = filename_base # Base name trước khi đổi ext
                    if ext != ext2:
                        path2 = no_ext_path + '.' + ext2
                        os.rename(path, path2)
                        print('Renamed extension {} -> {}'.format(ext, ext2))
                        ext = ext2
                        
                    # Cập nhật đường dẫn file để lưu vào source.json
                    # Sử dụng f'{current_filename_base}.{ext}' vì path đã được rename/chuyển đổi
                    relative_file_path = os.path.join(folder_keyword_normalized, f'{current_filename_base}.{ext}')
                    
                    # Thêm thông tin vào metadata list
                    new_metadata_list.append({
                        "file_path": relative_file_path,
                        "image_url": link,
                        "page_url": page_link,
                        "keyword": keyword,
                        "site": site_name,
                        "creator_name": creator_name,
                        "author_name": author_name,
                        "copyright_statement": copyright_statement,
                    })

            except KeyboardInterrupt:
                break
                        
            except Exception as e:
                print('Download failed - ', e)
                continue
                
        return new_metadata_list # Trả về list metadata mới

    # Hàm này chạy trong pool process, cần trả về metadata list
    def download_from_site(self, keyword, site_code, url_suffix, filter_name, normalized_keyword):
        
        site_name_base = Sites.get_text(site_code)
        
        # Tên dùng cho metadata và file _done
        site_name_for_metadata = f'{site_name_base}_{filter_name}' if filter_name != 'default' else site_name_base
        
        # 1. Thêm bộ lọc khuôn mặt (nếu được bật) và URL suffix (region + license)
        full_url = (Sites.get_face_url(site_code) if self.face else "") + url_suffix
        
        keyword_dir = os.path.join(self.download_path, normalized_keyword)
        
        # --- FIX LỖI GIỚI HẠN ĐA LUỒNG: Kiểm tra số lượng đã tải ngay trước khi bắt đầu ---
        
        # 2. Đếm số lượng file hiện có để xác định current_count và remaining_to_download
        if os.path.exists(keyword_dir):
            # Chỉ đếm file ảnh, loại bỏ file done/json
            current_count = len([f for f in os.listdir(keyword_dir) if os.path.isfile(os.path.join(keyword_dir, f)) and not f.endswith('_done') and not f.endswith('.json')])
        else:
            current_count = 0
            
        remaining_to_download = self.limit - current_count
        limit_to_use_in_download = max(remaining_to_download, 1) if self.limit > 0 else 0
        
        dir_done_file = os.path.join(keyword_dir, f'{site_name_for_metadata}_done')
        
        # Nếu giới hạn đã đạt HOẶC task đã hoàn thành, bỏ qua (chỉ khi skip=True)
        if (self.limit > 0 and remaining_to_download <= 0) or (os.path.exists(dir_done_file) and self.skip):
            if self.limit > 0 and remaining_to_download <= 0:
                print(f"Skipping {keyword} on {site_name_for_metadata}. Hard limit {self.limit} already reached/exceeded by other threads.")
            elif os.path.exists(dir_done_file) and self.skip:
                print(f"Skipping {keyword} on {site_name_for_metadata} (Already Done).")
            
            # Đánh dấu hoàn thành nếu nó đạt giới hạn
            Path(dir_done_file).touch()
            return [] 

        
        # --- Tiếp tục nếu còn cần tải ---
        
        try:
            proxy = None
            if self.proxy_list:
                proxy = random.choice(self.proxy_list)
            collect = CollectLinks(no_gui=self.no_gui, proxy=proxy)  # initialize chrome driver
        except Exception as e:
            print('Error occurred while initializing chromedriver - {}'.format(e))
            return []

        try:
            print('Collecting links... {} from {}'.format(keyword, site_name_for_metadata))

            # Thu thập dư ra một chút để có lựa chọn tốt hơn, hoặc 10000 nếu limit vô hạn
            limit_for_collection = limit_to_use_in_download + 50 if self.limit > 0 else 10000
            
            if site_code == Sites.GOOGLE:
                links_data = collect.google(keyword, full_url, limit_for_collection)
            elif site_code == Sites.NAVER:
                links_data = collect.naver(keyword, full_url, limit_for_collection)
            elif site_code == Sites.GOOGLE_FULL:
                links_data = collect.google_full(keyword, full_url, limit_for_collection)
            elif site_code == Sites.NAVER_FULL:
                links_data = collect.naver_full(keyword, full_url, limit_for_collection)
            else:
                print('Invalid Site Code')
                links_data = []

            print('Downloading images from collected links... {} from {}'.format(keyword, site_name_for_metadata))
            
            # Download chỉ số lượng CẦN THIẾT (limit_to_use_in_download) và truyền current_count để tính index
            new_metadata = self.download_images(
                keyword, 
                links_data, 
                site_name_for_metadata, 
                max_count=limit_to_use_in_download,
                current_total_files=current_count # Truyền tổng số file đã có
            )
            
            # Đánh dấu hoàn thành cho source này
            Path(dir_done_file).touch()

            print('Done {} : {}'.format(site_name_for_metadata, keyword))
            
            # Trả về metadata mới
            return new_metadata

        except Exception as e:
            print('Exception {}:{} - {}'.format(site_name_for_metadata, keyword, e))
            return []
        finally:
            # Cleanup driver
            try:
                collect.browser.quit()
            except:
                pass


    def download(self, args):
        # Định nghĩa lại download để phù hợp với tasks: [keyword, site_code, full_url_suffix, filter_name, normalized_keyword]
        keyword = args[0]
        site_code = args[1]
        full_url_suffix = args[2]
        filter_name = args[3]
        normalized_keyword = args[4]
        
        # Hàm này trả về list of dicts (metadata)
        return self.download_from_site(
            keyword=keyword, 
            site_code=site_code, 
            url_suffix=full_url_suffix, 
            filter_name=filter_name,
            normalized_keyword=normalized_keyword
        )

    def init_worker(self):
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        
    def do_crawling(self):
        keywords = self.get_keywords()
        
        # Tải lại dữ liệu cũ ngay trước khi bắt đầu để đảm bảo dữ liệu là mới nhất
        self._load_source_data()
        old_source_data = self.source_data
        
        tasks = []
        
        google_sites = [Sites.GOOGLE_FULL] if self.full_resolution else [Sites.GOOGLE]
        naver_sites = [Sites.NAVER_FULL] if self.full_resolution else [Sites.NAVER]
        
        # Step 1: Chuẩn bị tasks
        for keyword in keywords:
            normalized_keyword = self.normalize_keyword_for_filename(keyword)
            keyword_dir = os.path.join(self.download_path, normalized_keyword)
            
            # --- Google Tasks (3 nguồn: default, cc, commercial) ---
            if self.do_google:
                for site_code in google_sites:
                    site_name_base = Sites.get_text(site_code)
                    
                    for l_filter in self.google_filters:
                        filter_name = l_filter['name']
                        task_name = f'{site_name_base}_{filter_name}' if filter_name != 'default' else site_name_base
                        dir_done_file = os.path.join(keyword_dir, f'{task_name}_done')
                        
                        # Vẫn thêm task bất kể file done có tồn tại hay không. 
                        # Việc kiểm tra giới hạn và file done sẽ được thực hiện lại trong download_from_site 
                        # để đảm bảo tính kịp thời của dữ liệu đa luồng.
                        
                        full_url_suffix = self.country_filter + l_filter['url_suffix']
                        # Task: [keyword, site_code, full_url_suffix, filter_name, normalized_keyword]
                        tasks.append([keyword, site_code, full_url_suffix, filter_name, normalized_keyword])

            # --- Naver Tasks (1 nguồn) ---
            if self.do_naver:
                for site_code in naver_sites:
                    site_name_base = Sites.get_text(site_code)
                    task_name = site_name_base
                    dir_done_file = os.path.join(keyword_dir, f'{task_name}_done')
                    
                    # Naver không dùng filter vùng/license
                    tasks.append([keyword, site_code, "", "default", normalized_keyword])
        
        # Rút gọn danh sách task nếu có trùng lặp 
        tasks = [list(t) for t in set(tuple(t) for t in tasks)]
        # random.shuffle(tasks)
        
        new_metadata_results = []
        try:
            pool = Pool(self.n_threads, initializer=self.init_worker)
            # Pool map trả về list các kết quả (list of list of dicts)
            results = pool.map(self.download, tasks)
            
            # Thu thập tất cả metadata mới từ các worker
            for result_list in results:
                new_metadata_results.extend(result_list)
                
        except KeyboardInterrupt:
            pool.terminate()
            pool.join()
        else:
            pool.terminate()
            pool.join()
        print('Task ended. Pool join.')
        
        # 3. Ghi lại source.json (Giai đoạn quan trọng, chạy ở main process)
        print('Merging new metadata and writing source.json...')
        
        # Lấy tất cả file path của dữ liệu mới
        new_file_paths = {d['file_path'] for d in new_metadata_results}
        
        # Lọc bỏ data cũ nếu file_path của nó nằm trong danh sách file được tải lại
        final_source_data = [d for d in old_source_data if d['file_path'] not in new_file_paths]
        
        # Thêm data mới
        final_source_data.extend(new_metadata_results)
        self.source_data = final_source_data # Cập nhật source_data cho imbalance_check
        
        # Ghi toàn bộ list final_source_data
        with open(self.source_file_path, 'w', encoding='utf-8') as f:
            json.dump(final_source_data, f, ensure_ascii=False, indent=4)
        print(f'source.json written successfully. Total records: {len(final_source_data)}')


        self.imbalance_check()

        print('End Program')
        
    def imbalance_check(self):
        print('Data imbalance checking...')

        dict_num_files = {}
        
        # Chỉ lấy thư mục nằm trong download_path
        keyword_dirs_full_path = [d for d in self.all_dirs(self.download_path)]
        keyword_dirs_name = [os.path.basename(d) for d in keyword_dirs_full_path]
        
        # Cập nhật lại số lượng file cho từng thư mục dựa trên filesystem
        for dir_path in keyword_dirs_full_path:
            # Cần loại bỏ file source.json và done files khỏi danh sách đếm
            files = [f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f)) and not f.endswith('_done') and not f.endswith('.json')]
            n_files = len(files)
            dict_num_files[dir_path] = n_files

        avg = 0
        
        if len(keyword_dirs_full_path) > 0:
            for dir_path in keyword_dirs_full_path:
                n_files = dict_num_files.get(dir_path, 0)
                avg += n_files
                print('dir: {}, file_count: {}'.format(os.path.basename(dir_path), n_files))
            avg /= len(keyword_dirs_full_path)
        
        dict_too_small = {}

        for dir_path in keyword_dirs_full_path:
            n_files = dict_num_files.get(dir_path, 0)
            if n_files < avg * 0.5:
                dict_too_small[dir_path] = n_files

        if len(dict_too_small) >= 1:
            print('Data imbalance detected.')
            print('Below keywords have smaller than 50% of average file count.')
            print('I recommend you to remove these directories and re-download for that keyword.')
            print('_________________________________')
            for dir_path, n_files in dict_too_small.items():
                print('dir: {}, file_count: {}'.format(os.path.basename(dir_path), n_files))

            print("Remove directories above? (y/n)")
            answer = input()

            if answer == 'y':
                # removing directories too small files
                print("Removing too small file count directories...")
                
                # Cần cập nhật lại source.json sau khi xóa thư mục
                keywords_to_remove = {os.path.basename(dir_path) for dir_path in dict_too_small.keys()}
                
                for dir_path, n_files in dict_too_small.items():
                    shutil.rmtree(dir_path)
                    print('Removed {}'.format(dir_path))
                    
                # Cập nhật source.json: lọc bỏ các bản ghi thuộc các thư mục đã xóa
                self.source_data = [d for d in self.source_data if os.path.basename(os.path.dirname(d['file_path'])) not in keywords_to_remove]
                with open(self.source_file_path, 'w', encoding='utf-8') as f:
                    json.dump(self.source_data, f, ensure_ascii=False, indent=4)
                    
                print('Now re-run this program to re-download removed files. (with skip_already_exist=True)')
        else:
            print('Data imbalance not detected.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip', type=str, default='true',
                        help='Skips keyword already downloaded before. This is needed when re-downloading.')
    parser.add_argument('--threads', type=int, default=4, help='Number of threads to download.')
    parser.add_argument('--google', type=str, default='true', help='Download from google.com (boolean)')
    parser.add_argument('--naver', type=str, default='true', help='Download from naver.com (boolean)')
    parser.add_argument('--full', type=str, default='false',
                        help='Download full resolution image instead of thumbnails (slow)')
    parser.add_argument('--face', type=str, default='false', help='Face search mode')
    parser.add_argument('--no_gui', type=str, default='auto',
                        help='No GUI mode. Acceleration for full_resolution mode. '
                             'But unstable on thumbnail mode. '
                             'Default: "auto" - false if full=false, true if full=true')
    parser.add_argument('--limit', type=int, default=0,
                        help='Maximum total count of images to download per keyword across all sites/filters. (0: infinite)')
    parser.add_argument('--proxy-list', type=str, default='',
                        help='The comma separated proxy list like: "socks://127.0.0.1:1080,http://127.0.0.1:1081". '
                             'Every thread will randomly choose one from the list.')
    # Bỏ license-filter vì nó đã được hardcode trong logic mới
    args = parser.parse_args()

    _skip = False if str(args.skip).lower() == 'false' else True
    _threads = args.threads
    _google = False if str(args.google).lower() == 'false' else True
    _naver = False if str(args.naver).lower() == 'false' else True
    _full = False if str(args.full).lower() == 'false' else True
    _face = False if str(args.face).lower() == 'false' else True
    _limit = int(args.limit)
    _proxy_list = args.proxy_list.split(',')

    no_gui_input = str(args.no_gui).lower()
    if no_gui_input == 'auto':
        _no_gui = _full
    elif no_gui_input == 'true':
        _no_gui = True
    else:
        _no_gui = False
        
    # Bỏ _license_filter

    print(
        'Options - skip:{}, threads:{}, google:{}, naver:{}, full_resolution:{}, face:{}, no_gui:{}, limit:{}, _proxy_list:{}'
            .format(_skip, _threads, _google, _naver, _full, _face, _no_gui, _limit, _proxy_list))

    crawler = AutoCrawler(skip_already_exist=_skip, n_threads=_threads,
                          do_google=_google, do_naver=_naver, full_resolution=_full,
                          face=_face, no_gui=_no_gui, limit=_limit, proxy_list=_proxy_list)
    crawler.do_crawling()