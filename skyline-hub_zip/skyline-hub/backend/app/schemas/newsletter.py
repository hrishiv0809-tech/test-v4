from pydantic import BaseModel, EmailStr

class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    name: str | None = None

class SubscriberResponse(BaseModel):
    id: int
    email: str
    name: str | None = None
    subscribed: bool

    class Config:
        from_attributes = True
