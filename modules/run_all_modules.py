import asyncio
import subprocess
import sys
import os
from concurrent.futures import ThreadPoolExecutor
import time

def run_module(module_name, port):
    """Tek bir modülü çalıştırır"""
    try:
        print(f"🚀 {module_name} modülü başlatılıyor (Port: {port})...")
        venv_python = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            subprocess.run([venv_python, f"{module_name}.py"], cwd=os.path.dirname(__file__))
        else:
            print(f"❌ Virtual environment not found at {venv_python}")
            subprocess.run([sys.executable, f"{module_name}.py"], cwd=os.path.dirname(__file__))
    except Exception as e:
        print(f"❌ {module_name} modülünde hata: {e}")

def main():
    """Tüm modülleri aynı anda başlatır"""
    print("=" * 50)
    print("🎯 IELTS Go - Tüm Modüller Başlatılıyor")
    print("=" * 50)
    
    modules = [
        ("reading", 8001),
        ("writing", 8002), 
        ("listening", 8003),
        ("speaking", 8004)
    ]
    
    print(f"📋 {len(modules)} modül başlatılacak:")
    for module, port in modules:
        print(f"   • {module.title()} Modülü - Port: {port}")
    
    print("\n" + "=" * 50)
    print("🚀 Modüller başlatılıyor...")
    print("=" * 50)
    
    # ThreadPoolExecutor ile tüm modülleri aynı anda başlat
    with ThreadPoolExecutor(max_workers=len(modules)) as executor:
        futures = []
        
        for module, port in modules:
            future = executor.submit(run_module, module, port)
            futures.append(future)
        
        # Tüm modüllerin başlamasını bekle
        time.sleep(2)
        
        print("\n" + "=" * 50)
        print("✅ Tüm modüller başlatıldı!")
        print("=" * 50)
        print("🌐 Servis URL'leri:")
        print("   • Reading:   http://localhost:8001")
        print("   • Writing:   http://localhost:8002")
        print("   • Listening: http://localhost:8003")
        print("   • Speaking:  http://localhost:8004")
        print("=" * 50)
        print("💡 Modülleri durdurmak için Ctrl+C tuşlayın")
        print("=" * 50)
        
        try:
            # Tüm modüllerin çalışmaya devam etmesini bekle
            for future in futures:
                future.result()
        except KeyboardInterrupt:
            print("\n🛑 Modüller durduruluyor...")
            print("✅ Tüm modüller başarıyla durduruldu!")

if __name__ == "__main__":
    main()
