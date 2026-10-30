class ChatNotFoundError(Exception):
    def __init__(self, chat_id: int):
        super().__init__(f"Chat with id {chat_id} not found")
        self.chat_id = chat_id


class MessageNotFoundError(Exception):
    def __init__(self, message_id: int):
        super().__init__(f"Message with id {message_id} not found")
        self.message_id = message_id


class UserAlreadyExistsError(Exception):
    def __init__(self, username: str):
        super().__init__(f"Пользователь {username} уже существует")
        self.username = username


class InvalidCredentialsError(Exception):
    def __init__(self):
        super().__init__("Неверный логин или пароль")


# Подсказка для GigaChat 401: ключ пустой/просрочен — это частая ошибка при первом запуске.
GIGACHAT_AUTH_MESSAGE = (
    "GigaChat отклонил ключ (401). Проверьте GIGACHAT_CREDENTIALS в apps/api/.env "
    "и перезапустите backend или выберите локальную модель в настройках."
)
