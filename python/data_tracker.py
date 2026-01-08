"""
Data Tracker for Incremental Crawling
Tracks existing data to detect and crawl only new items
"""

import os
import csv
import json
import hashlib
from datetime import datetime
from pathlib import Path


class DataTracker:
    """Track crawled data for incremental updates"""
    
    def __init__(self, data_dir='data'):
        self.data_dir = Path(data_dir)
        self.tracker_file = self.data_dir / '.tracker.json'
        self.tracker = self._load_tracker()
    
    def _load_tracker(self):
        """Load existing tracker data"""
        if self.tracker_file.exists():
            with open(self.tracker_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            'last_update': None,
            'features': {}
        }
    
    def _save_tracker(self):
        """Save tracker data"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.tracker['last_update'] = datetime.now().isoformat()
        with open(self.tracker_file, 'w', encoding='utf-8') as f:
            json.dump(self.tracker, f, ensure_ascii=False, indent=2)
    
    def get_existing_ids(self, feature):
        """Get set of existing item IDs for a feature"""
        if feature not in self.tracker['features']:
            return set()
        return set(self.tracker['features'][feature].get('ids', []))
    
    def add_item(self, feature, item_id, metadata=None):
        """Add a new item to tracking"""
        if feature not in self.tracker['features']:
            self.tracker['features'][feature] = {
                'ids': [],
                'count': 0,
                'last_crawl': None
            }
        
        if item_id not in self.tracker['features'][feature]['ids']:
            self.tracker['features'][feature]['ids'].append(item_id)
            self.tracker['features'][feature]['count'] += 1
        
        self.tracker['features'][feature]['last_crawl'] = datetime.now().isoformat()
    
    def is_new(self, feature, item_id):
        """Check if an item is new"""
        existing = self.get_existing_ids(feature)
        return item_id not in existing
    
    def get_stats(self, feature=None):
        """Get statistics for a feature or all features"""
        if feature:
            return self.tracker['features'].get(feature, {})
        return {
            'last_update': self.tracker['last_update'],
            'features': {
                k: {
                    'count': v.get('count', 0),
                    'last_crawl': v.get('last_crawl')
                }
                for k, v in self.tracker['features'].items()
            }
        }
    
    def generate_item_id(self, data):
        """Generate unique ID from item data"""
        # Create hash from relevant fields
        key_data = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(key_data.encode()).hexdigest()[:12]
    
    def sync_from_csv(self, feature, csv_path, id_column='Link'):
        """Sync tracker with existing CSV data"""
        csv_path = Path(csv_path)
        if not csv_path.exists():
            return 0
        
        count = 0
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                item_id = row.get(id_column, '') or self.generate_item_id(row)
                self.add_item(feature, item_id)
                count += 1
        
        self._save_tracker()
        return count
    
    def append_to_csv(self, csv_path, data, fieldnames=None):
        """Append new data to CSV, avoiding duplicates"""
        csv_path = Path(csv_path)
        
        # Determine fieldnames
        if not fieldnames and csv_path.exists():
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
        
        if not fieldnames and data:
            fieldnames = list(data[0].keys())
        
        # Check if file exists
        file_exists = csv_path.exists()
        
        # Append new data
        with open(csv_path, 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
            
            for row in data:
                writer.writerow(row)
        
        return len(data)
    
    def save(self):
        """Save tracker state"""
        self._save_tracker()


def test_tracker():
    """Test the tracker functionality"""
    tracker = DataTracker('test_data')
    
    # Add some items
    tracker.add_item('hotels', 'hotel_001', {'name': 'Hotel A'})
    tracker.add_item('hotels', 'hotel_002', {'name': 'Hotel B'})
    tracker.add_item('restaurants', 'rest_001', {'name': 'Restaurant A'})
    
    # Check if new
    print(f"hotel_001 is new: {tracker.is_new('hotels', 'hotel_001')}")
    print(f"hotel_003 is new: {tracker.is_new('hotels', 'hotel_003')}")
    
    # Get stats
    print(f"Stats: {tracker.get_stats()}")
    
    tracker.save()


if __name__ == '__main__':
    test_tracker()
