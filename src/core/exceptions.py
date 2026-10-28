class ChatNotFoundError(Exception):
    def __init__(self, chat_id: int):
        super().__init__(f"Chat with id {chat_id} not found")
        self.chat_id = chat_id


class UserAlreadyExistsError(Exception):
    def __init__(self, username: str):
        super().__init__(f"Пользователь {username} уже существует")
        self.username = username


class InvalidCredentialsError(Exception):
    def __init__(self):
        super().__init__("Неверный логин или пароль")
