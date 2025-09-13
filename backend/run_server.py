#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)