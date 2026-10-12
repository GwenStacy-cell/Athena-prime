import sys
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QTextEdit, QLineEdit, QPushButton, QLabel, QSplitter
)
from PySide6.QtCore import Qt

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("AI Desktop Agent")
        self.resize(1100, 750)
        self.init_ui()

    def init_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QHBoxLayout(main_widget)

        # Splitter allows user to resize sidebar, main content, and task panel
        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)
        main_layout.setContentsMargins(0, 0, 0, 0)

        # ==========================================
        # Left Side: Sidebar
        # ==========================================
        sidebar = QWidget()
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.addWidget(QLabel("<b>Navigation</b>"))
        
        self.btn_history = QPushButton("Conversation History")
        self.btn_projects = QPushButton("Projects")
        self.btn_files = QPushButton("Files")
        self.btn_memory = QPushButton("Memory")
        self.btn_tools = QPushButton("Tools")
        self.btn_settings = QPushButton("Settings")
        
        for btn in [self.btn_history, self.btn_projects, self.btn_files, 
                    self.btn_memory, self.btn_tools, self.btn_settings]:
            sidebar_layout.addWidget(btn)
            
        sidebar_layout.addStretch()

        # ==========================================
        # Middle: Main Chat Area
        # ==========================================
        chat_area = QWidget()
        chat_layout = QVBoxLayout(chat_area)
        
        # Chat Display
        self.chat_display = QTextEdit()
        self.chat_display.setReadOnly(True)
        self.chat_display.append("<b>Agent:</b> Online and ready. How can I help you today?")
        
        # Live Activity Indicator
        self.activity_label = QLabel("<i>Listening...</i>")
        self.activity_label.setStyleSheet("color: gray;")
        self.activity_label.hide() # Hidden by default
        
        # Input Area
        input_layout = QHBoxLayout()
        self.text_input = QLineEdit()
        self.text_input.setPlaceholderText("Type a message or command...")
        
        self.attach_btn = QPushButton("📎")
        self.attach_btn.setToolTip("Attach File or Screenshot")
        
        self.screen_btn = QPushButton("📺")
        self.screen_btn.setToolTip("Share Screen")
        
        self.mic_btn = QPushButton("🎤")
        self.mic_btn.setToolTip("Push to Talk / Toggle Voice")
        
        self.stop_btn = QPushButton("🛑")
        self.stop_btn.setToolTip("Emergency Stop (Ctrl+Shift+Esc)")
        self.stop_btn.setStyleSheet("background-color: #d9534f; color: white;")

        input_layout.addWidget(self.attach_btn)
        input_layout.addWidget(self.screen_btn)
        input_layout.addWidget(self.text_input)
        input_layout.addWidget(self.mic_btn)
        input_layout.addWidget(self.stop_btn)

        chat_layout.addWidget(self.chat_display)
        chat_layout.addWidget(self.activity_label)
        chat_layout.addLayout(input_layout)

        # ==========================================
        # Right Side: Task Panel
        # ==========================================
        task_panel = QWidget()
        task_layout = QVBoxLayout(task_panel)
        task_layout.addWidget(QLabel("<b>Current Task</b>"))
        
        self.task_status = QLabel("No active task.")
        self.task_status.setWordWrap(True)
        
        self.task_steps = QTextEdit()
        self.task_steps.setReadOnly(True)
        self.task_steps.setPlaceholderText("Task steps will appear here...")
        
        task_layout.addWidget(self.task_status)
        task_layout.addWidget(QLabel("Steps:"))
        task_layout.addWidget(self.task_steps)
        
        self.cancel_task_btn = QPushButton("Cancel Task")
        task_layout.addWidget(self.cancel_task_btn)

        # Add to splitter
        splitter.addWidget(sidebar)
        splitter.addWidget(chat_area)
        splitter.addWidget(task_panel)
        
        # Default widths
        splitter.setSizes([200, 600, 250])
