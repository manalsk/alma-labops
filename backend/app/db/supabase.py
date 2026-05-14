from supabase import Client, create_client

from app.config import settings


def get_supabase_client() -> Client:
    """Backend-only client using service role key — bypasses RLS for trusted operations."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_user_client(user_jwt: str) -> Client:
    """User-scoped client that respects RLS policies."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(user_jwt, "")
    return client
