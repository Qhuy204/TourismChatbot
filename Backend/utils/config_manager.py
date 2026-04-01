import os
import xml.etree.ElementTree as ET
from typing import Any, Dict, Optional

class ChatConfig:
    _instance = None
    _config_data: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChatConfig, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "config.xml")
        if not os.path.exists(config_path):
            print(f"⚠️ Config for file not found at {config_path}. Using defaults.")
            return

        try:
            tree = ET.parse(config_path)
            root = tree.getroot()
            self._config_data = self._parse_element(root)
        except Exception as e:
            print(f"❌ Error parsing config.xml: {e}")

    def _parse_element(self, element: ET.Element) -> Dict[str, Any]:
        data = {}
        for child in element:
            if len(child) > 0:
                data[child.tag] = self._parse_element(child)
            else:
                text = child.text if child.text is not None else ""
                val = text.strip()
                # Auto-detect types: int, float, bool
                if val.lower() == "true":
                    val = True
                elif val.lower() == "false":
                    val = False
                elif val.isdigit():
                    val = int(val)
                else:
                    try:
                        val = float(val)
                    except ValueError:
                        pass
                data[child.tag] = val
        return data

    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get config value using dot notation (e.g., 'llm.temperature_default')
        """
        keys = key_path.split('.')
        curr = self._config_data
        for k in keys:
            if isinstance(curr, dict) and k in curr:
                curr = curr[k]
            else:
                return default
        return curr

# Singleton Instance
config = ChatConfig()
