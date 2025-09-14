import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.speaking import mock_messages_db, MessageCreate, save_message
import asyncio

async def add_test_data():
    test_messages = [
        {
            "topicId": "health",
            "topicTitle": "Health & Lifestyle", 
            "message": "I eating egg every morning"
        },
        {
            "topicId": "education",
            "topicTitle": "Eğitim ve Öğrenme",
            "message": "I think education is very important for everyone. We should always try to learn new things because knowledge is power."
        },
        {
            "topicId": "technology", 
            "topicTitle": "Teknoloji ve Gelecek",
            "message": "Technology changes our lives. I dont know how we lived without smartphones before."
        },
        {
            "topicId": "environment",
            "topicTitle": "Çevre ve Doğa",
            "message": "We need to protect environment for future generations. Global warming is real problem that affects everyone."
        }
    ]
    
    for msg_data in test_messages:
        message_create = MessageCreate(**msg_data)
        await save_message(message_create)
    
    print(f"{len(test_messages)} test mesajı eklendi")
    print(f"Toplam mesaj sayısı: {len(mock_messages_db)}")

if __name__ == "__main__":
    asyncio.run(add_test_data())