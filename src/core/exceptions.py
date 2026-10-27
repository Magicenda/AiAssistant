class ChatNotFoundError(Exception):
    def __init__(self, chat_id: int):
        super().__init__(f"Chat with id {chat_id} not found")
        self.chat_id = chat_id
