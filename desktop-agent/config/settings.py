import json
import os
from pathlib import Path

class Config:
    def __init__(self):
        # Store configuration in user's home directory
        self.config_dir = Path.home() / ".desktop_ai_agent"
        self.config_file = self.config_dir / "config.json"
        
        # Default configuration values
        self.default_config = {
            "ai_provider": "local",
            "theme": "dark",
            "wake_word_enabled": False,
            "permissions": {
                "read": "automatic",
                "write": "confirmation",
                "delete": "confirmation",
                "system": "confirmation"
            },
            "security": {
                "allow_remote_connections": False,
                "require_auth_for_destructive": True
            }
        }
        self.settings = self.load_config()

    def load_config(self):
        if not self.config_dir.exists():
            self.config_dir.mkdir(parents=True, exist_ok=True)
        if not self.config_file.exists():
            self.save_config(self.default_config)
            return self.default_config
        with open(self.config_file, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return self.default_config

    def save_config(self, data=None):
        if data is None:
            data = self.settings
        with open(self.config_file, "w") as f:
            json.dump(data, f, indent=4)

    def get(self, key, default=None):
        return self.settings.get(key, default)

    def set(self, key, value):
        self.settings[key] = value
        self.save_config()

# Global config singleton
config = Config()
