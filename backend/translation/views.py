import os
import re
import uuid
import time
import tempfile
import subprocess
import requests
import urllib.parse
import asyncio
import logging

from functools import lru_cache

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from deep_translator import GoogleTranslator
from gtts import gTTS
import speech_recognition as sr
from pydub import AudioSegment

try:
    from rest_framework_simplejwt.authentication import JWTAuthentication
except Exception:
    JWTAuthentication = None

from history.utils import save_to_history

from .models import (
    Language,
    TranslationHistory,
    FavoriteTranslation,
    SpeechProfile,
)

from users.models import Notification

from .serializers import (
    LanguageSerializer,
    TranslationRequestSerializer,
    TranslationHistorySerializer,
    FavoriteTranslationSerializer,
    SpeechProfileSerializer,
)

logger = logging.getLogger(__name__)


# ============================================================
# FFMPEG CONFIGURATION
# ============================================================

def configure_ffmpeg():
    base_download = r"C:\Users\khand\Downloads"

    possible_ffmpeg_paths = [
        os.path.join(base_download, "ffmpeg-9.0.1-essentials_build", "bin", "ffmpeg-9.0.1-essentials_build", "bin", "ffmpeg.exe"),
        os.path.join(base_download, "ffmpeg-9.0.1-essentials_build", "bin", "ffmpeg.exe"),
        r"C:\ffmpeg\bin\ffmpeg.exe",
        "ffmpeg",
    ]

    possible_ffprobe_paths = [
        os.path.join(base_download, "ffmpeg-9.0.1-essentials_build", "bin", "ffmpeg-9.0.1-essentials_build", "bin", "ffprobe.exe"),
        os.path.join(base_download, "ffmpeg-9.0.1-essentials_build", "bin", "ffprobe.exe"),
        r"C:\ffmpeg\bin\ffprobe.exe",
        "ffprobe",
    ]

    ffmpeg_path = None
    ffprobe_path = None

    for path in possible_ffmpeg_paths:
        try:
            if os.path.isfile(path):
                ffmpeg_path = os.path.normpath(path)
                break
        except Exception:
            continue

    for path in possible_ffprobe_paths:
        try:
            if os.path.isfile(path):
                ffprobe_path = os.path.normpath(path)
                break
        except Exception:
            continue

    if not ffmpeg_path or not ffprobe_path:
        raise RuntimeError(
            "FFmpeg or FFprobe not found.\n"
            f"Checked paths:\nFFmpeg: {possible_ffmpeg_paths}\nFFprobe: {possible_ffprobe_paths}"
        )

    AudioSegment.converter = ffmpeg_path
    AudioSegment.ffmpeg = ffmpeg_path
    AudioSegment.ffprobe = ffprobe_path

    ffmpeg_dir = os.path.dirname(ffmpeg_path)
    current_path = os.environ.get("PATH", "")
    if ffmpeg_dir not in current_path.split(os.pathsep):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + current_path

    print(f"✅ FFmpeg found: {ffmpeg_path}")
    print(f"✅ FFprobe found: {ffprobe_path}")
    return ffmpeg_path, ffprobe_path

try:
    configure_ffmpeg()
except Exception as exc:
    print(f"⚠️ FFMPEG WARNING: {exc}")


# ============================================================
# SUPPORTED LANGUAGES & HELPERS
# ============================================================

SUPPORTED_LANGUAGES = {
    "auto": "auto", "en": "en", "en-us": "en", "en-gb": "en",
    "hi": "hi", "hi-in": "hi", "es": "es", "es-es": "es",
    "fr": "fr", "fr-fr": "fr", "de": "de", "de-de": "de",
    "it": "it", "it-it": "it", "pt": "pt", "pt-br": "pt", "pt-pt": "pt",
    "ru": "ru", "ru-ru": "ru", "ja": "ja", "ja-jp": "ja",
    "ko": "ko", "ko-kr": "ko", "zh": "zh-CN", "zh-cn": "zh-CN", "zh-tw": "zh-TW",
    "ar": "ar", "ar-sa": "ar", "tr": "tr", "tr-tr": "tr",
    "nl": "nl", "nl-nl": "nl", "pl": "pl", "pl-pl": "pl",
    "sv": "sv", "sv-se": "sv", "id": "id", "id-id": "id",
    "vi": "vi", "vi-vn": "vi", "uk": "uk", "uk-ua": "uk",
    "mr": "mr", "mr-in": "mr", "ta": "ta", "ta-in": "ta",
    "te": "te", "te-in": "te", "ml": "ml", "ml-in": "ml",
    "bn": "bn", "bn-in": "bn", "gu": "gu", "gu-in": "gu",
}

NON_LATIN_LANGUAGES = {"hi", "mr", "ta", "te", "ml", "bn", "gu", "ar", "ru", "uk", "ja", "ko", "zh"}

SPEECH_LOCALES = {
    "en": "en-US", "hi": "hi-IN", "es": "es-ES", "fr": "fr-FR", "de": "de-DE",
    "it": "it-IT", "pt": "pt-PT", "ru": "ru-RU", "ja": "ja-JP", "ko": "ko-KR",
    "zh": "zh-CN", "ar": "ar-SA", "tr": "tr-TR", "nl": "nl-NL", "pl": "pl-PL",
    "sv": "sv-SE", "id": "id-ID", "vi": "vi-VN", "uk": "uk-UA", "mr": "mr-IN",
    "ta": "ta-IN", "te": "te-IN", "ml": "ml-IN", "bn": "bn-IN", "gu": "gu-IN",
}

AUTO_RECOGNITION_LOCALES = [
    "en-IN", "en-US", "hi-IN", "mr-IN", "ta-IN", "te-IN", "ml-IN", "bn-IN", "gu-IN",
    "es-ES", "fr-FR", "de-DE", "it-IT", "pt-PT", "ru-RU", "ja-JP", "ko-KR", "zh-CN", "ar-SA",
]

def normalize_language_code(language_code):
    if not language_code: return "en"
    code = str(language_code).strip().lower()
    aliases = {
        "auto": "auto", "zh": "zh-CN", "zh-cn": "zh-CN", "pt-br": "pt", "en-us": "en", "en-gb": "en",
        "es-es": "es", "fr-fr": "fr", "de-de": "de", "it-it": "it", "ja-jp": "ja", "ko-kr": "ko",
        "ar-sa": "ar", "ru-ru": "ru", "tr-tr": "tr", "nl-nl": "nl", "pl-pl": "pl", "sv-se": "sv",
        "id-id": "id", "vi-vn": "vi", "uk-ua": "uk", "mr-in": "mr", "ta-in": "ta", "te-in": "te",
        "ml-in": "ml", "bn-in": "bn", "gu-in": "gu",
    }
    return aliases.get(code, SUPPORTED_LANGUAGES.get(code, code))

def get_speech_locale(language_code):
    normalized = normalize_language_code(language_code)
    return None if normalized == "auto" else SPEECH_LOCALES.get(str(normalized).lower())

def normalize_tts_language(language_code):
    code = str(language_code).strip().lower()
    mapping = {
        "en": "en", "en-us": "en", "en-gb": "en", "hi": "hi", "hi-in": "hi", "es": "es", "es-es": "es",
        "fr": "fr", "fr-fr": "fr", "de": "de", "de-de": "de", "it": "it", "it-it": "it", "pt": "pt",
        "pt-br": "pt", "pt-pt": "pt", "ru": "ru", "ru-ru": "ru", "ja": "ja", "ja-jp": "ja", "ko": "ko",
        "ko-kr": "ko", "zh": "zh-cn", "zh-cn": "zh-cn", "zh-tw": "zh-tw", "ar": "ar", "ar-sa": "ar",
        "tr": "tr", "tr-tr": "tr", "nl": "nl", "nl-nl": "nl", "pl": "pl", "pl-pl": "pl", "sv": "sv",
        "sv-se": "sv", "id": "id", "id-id": "id", "vi": "vi", "vi-vn": "vi", "uk": "uk", "uk-ua": "uk",
        "mr": "mr", "mr-in": "mr", "ta": "ta", "ta-in": "ta", "te": "te", "te-in": "te", "ml": "ml",
        "ml-in": "ml", "bn": "bn", "bn-in": "bn", "gu": "gu", "gu-in": "gu",
    }
    return mapping.get(code, "en")

def normalize_mode(mode):
    value = str(mode or "").strip().lower()
    aliases = {
        "text-text": "text_to_text", "text-speech": "text_to_speech", "speech-text": "speech_to_text",
        "speech-speech": "speech_to_speech", "text_to_text": "text_to_text", "text_to_speech": "text_to_speech",
        "speech_to_text": "speech_to_text", "speech_to_speech": "speech_to_speech",
    }
    normalized = aliases.get(value, value)
    return normalized if normalized in {"text_to_text", "text_to_speech", "speech_to_text", "speech_to_speech"} else "text_to_text"

def get_mode_display_name(mode):
    normalized_mode = normalize_mode(mode)
    mode_names = {"text_to_text": "Text to Text", "text_to_speech": "Text to Speech", "speech_to_text": "Speech to Text", "speech_to_speech": "Speech to Speech"}
    return mode_names.get(normalized_mode, normalized_mode.replace("_", " ").title())

def normalize_engine(engine):
    value = str(engine or "").strip().lower()
    return value if value in {"grok", "google", "deepl", "microsoft", "mymemory"} else "google"

def parse_bool(value, default=False):
    if value is None: return default
    if isinstance(value, bool): return value
    if isinstance(value, int): return value != 0
    value = str(value).strip().lower()
    if value in {"true", "1", "yes", "y", "on"}: return True
    if value in {"false", "0", "no", "n", "off", "", "none", "null"}: return False
    return default

def get_optional_user(request):
    if JWTAuthentication is None: return None
    try:
        validated = JWTAuthentication().authenticate(request)
        if validated: return validated[0]
    except Exception:
        return None
    return None

def get_user_plan(user):
    plan = getattr(user, "plan", "free")
    return "free" if plan is None else str(plan).strip().lower()

def is_premium_user(user):
    return get_user_plan(user) in {"pro", "premium"}

def get_usage_info(user):
    return {
        "plan": get_user_plan(user), "is_premium": is_premium_user(user),
        "current_usage": int(getattr(user, "monthly_translation_chars", 0) or 0),
        "monthly_limit": int(getattr(user, "monthly_translation_limit", 50000) or 50000),
    }

def check_translation_limit(user, char_count):
    usage = get_usage_info(user)
    new_usage = usage["current_usage"] + char_count
    if usage["is_premium"] or usage["monthly_limit"] == 0:
        return {"allowed": True, "usage": usage, "new_usage": new_usage, "remaining": None}
    if new_usage > usage["monthly_limit"]:
        return {"allowed": False, "usage": usage, "new_usage": new_usage, "remaining": max(usage["monthly_limit"] - usage["current_usage"], 0)}
    return {"allowed": True, "usage": usage, "new_usage": new_usage, "remaining": usage["monthly_limit"] - new_usage}

def update_translation_usage(user, char_count):
    current = int(getattr(user, "monthly_translation_chars", 0) or 0)
    user.monthly_translation_chars = current + char_count
    user.save(update_fields=["monthly_translation_chars"])
    return user.monthly_translation_chars

def build_media_url(relative_path):
    if not relative_path: return None
    value = str(relative_path)
    if value.startswith(("http://", "https://")): return value
    backend_url = getattr(settings, "BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if not media_url.startswith("/"): media_url = "/" + media_url
    if not media_url.endswith("/"): media_url += "/"
    return f"{backend_url}{media_url}{value.lstrip('/')}"

def extract_latin_words(text):
    return re.findall(r"\b[A-Za-z][A-Za-z0-9'’-]*\b", text) if text else []

def is_latin_word(word):
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9'’-]*", word.strip()))

@lru_cache(maxsize=10000)
def translate_single_word(word, target_language):
    if not word: return word
    target = normalize_language_code(target_language)
    if target == "en": return word
    try:
        result = GoogleTranslator(source="en", target=target).translate(word)
        if result: return str(result).strip()
    except Exception:
        pass
    return word

def force_localize_remaining_words(translated_text, target_lang):
    target = normalize_language_code(target_lang)
    if not translated_text or target == "en" or target not in NON_LATIN_LANGUAGES:
        return translated_text
    words = extract_latin_words(translated_text)
    if not words: return translated_text
    unique_words = list(dict.fromkeys(w.lower() for w in words if is_latin_word(w)))
    replacements = {}
    for word in unique_words:
        if len(word) <= 1: continue
        localized = translate_single_word(word, target)
        if not localized or localized.strip().lower() == word.strip().lower(): continue
        replacements[word] = localized
    result = translated_text
    for original, localized in replacements.items():
        result = re.sub(rf"\b{re.escape(original)}\b", localized, result, flags=re.IGNORECASE)
    return result


# ============================================================
# TRANSLATION SERVICE (WITH HTML BLOCK REJECTION)
# ============================================================

class TranslationService:
    @staticmethod
    def _mymemory_translate(text, source_lang, target_lang):
        try:
            source = "autodetect" if source_lang == "auto" else source_lang
            lines = text.split("\n")
            chunks, current_chunk_lines, current_len = [], [], 0
            for line in lines:
                if current_len + len(line) + 1 > 450 and current_chunk_lines:
                    chunks.append("\n".join(current_chunk_lines))
                    current_chunk_lines, current_len = [], 0
                current_chunk_lines.append(line)
                current_len += len(line) + 1
            if current_chunk_lines: chunks.append("\n".join(current_chunk_lines))
            
            translated_lines = []
            for chunk in chunks:
                url = "https://api.mymemory.translated.net/get"
                response = requests.get(url, params={"q": chunk, "langpair": f"{source}|{target_lang}"}, timeout=15)
                if response.status_code == 429:
                    time.sleep(3)
                    response = requests.get(url, params={"q": chunk, "langpair": f"{source}|{target_lang}"}, timeout=15)
                if response.status_code == 429: return None
                response.raise_for_status()
                data = response.json()
                translated = data.get("responseData", {}).get("translatedText", "")
                translated_lines.append(translated if translated else chunk)
                time.sleep(0.5)
            return "\n".join(translated_lines).strip() if translated_lines else None
        except Exception as exc:
            logger.warning("MyMemory translation failed: %s", exc)
            return None

    @staticmethod
    def _lingva_translate(text, source_lang, target_lang):
        source = "auto" if source_lang == "auto" else source_lang
        encoded_text = urllib.parse.quote(text)
        for base_url in ["https://lingva.thedaviddelta.com", "https://lingva.ml"]:
            try:
                response = requests.get(f"{base_url}/api/v1/{source}/{target_lang}/{encoded_text}", timeout=15)
                if response.status_code == 200:
                    translated = response.json().get("translation", "")
                    if translated: return str(translated).strip()
            except Exception:
                continue
        return None

    @staticmethod
    def _libre_translate(text, source_lang, target_lang):
        source = "en" if source_lang == "auto" else source_lang
        payload = {"q": text, "source": source, "target": target_lang, "format": "text"}
        for url in ["https://translate.terraprint.co/translate", "https://libretranslate.de/translate"]:
            try:
                response = requests.post(url, json=payload, timeout=20)
                if response.status_code == 429: continue
                response.raise_for_status()
                translated = response.json().get("translatedText", "")
                if translated: return str(translated).strip()
            except Exception:
                continue
        return None

    @staticmethod
    def _google_translate(text, source_lang, target_lang):
        try:
            source = "auto" if source_lang == "auto" else source_lang
            result = GoogleTranslator(source=source, target=target_lang).translate(text)
            if result: return str(result).strip()
        except Exception:
            pass
        return None

    @staticmethod
    def _google_web_translate(text, source_lang, target_lang):
        try:
            source = "auto" if source_lang == "auto" else source_lang
            url = "https://translate.googleapis.com/translate_a/single"
            response = requests.get(url, params={"client": "gtx", "sl": source, "tl": target_lang, "dt": "t", "q": text}, 
                                    headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            if "application/json" not in response.headers.get("Content-Type", "").lower():
                return None
            response.raise_for_status()
            data = response.json()
            parts = [item[0] for item in (data[0] or []) if item and item[0]]
            translated = "".join(parts)
            return translated.strip() if translated else None
        except Exception as exc:
            logger.warning("Google web translation failed: %s", exc)
            return None

    @classmethod
    def translate(cls, text, source_lang, target_lang, mode="text_to_text", localize_terms=True, engine="google", **kwargs):
        if not text or not str(text).strip(): return ""
        text = str(text).replace("\x00", "").strip()
        source, target = normalize_language_code(source_lang), normalize_language_code(target_lang)
        if source != "auto" and source.lower() == target.lower(): return text

        translated = None
        req_engine = normalize_engine(engine)
        
        # Define fallback order based on requested engine
        if req_engine == "mymemory":
            engines_to_try = ["mymemory", "lingva", "libre", "google", "google_web"]
        elif req_engine == "deepl":
            engines_to_try = ["deepl", "mymemory", "lingva", "libre", "google", "google_web"]
        elif req_engine == "microsoft":
            engines_to_try = ["microsoft", "mymemory", "lingva", "libre", "google", "google_web"]
        else: # default to google
            engines_to_try = ["google", "google_web", "mymemory", "lingva", "libre"]

        for eng in engines_to_try:
            try:
                if eng == "mymemory":
                    translated = cls._mymemory_translate(text, source, target)
                elif eng == "lingva":
                    translated = cls._lingva_translate(text, source, target)
                elif eng == "libre":
                    translated = cls._libre_translate(text, source, target)
                elif eng == "google":
                    translated = cls._google_translate(text, source, target)
                elif eng == "google_web":
                    translated = cls._google_web_translate(text, source, target)
                elif eng == "deepl":
                    api_key = getattr(settings, "DEEPL_API_KEY", "")
                    if api_key:
                        payload = {"auth_key": api_key, "text": text, "target_lang": target.upper()}
                        if source != "auto": payload["source_lang"] = source.upper()
                        response = requests.post("https://api-free.deepl.com/v2/translate", data=payload, timeout=15)
                        response.raise_for_status()
                        translated = response.json()["translations"][0]["text"].strip()
                elif eng == "microsoft":
                    api_key = getattr(settings, "MICROSOFT_TRANSLATOR_KEY", "")
                    if api_key:
                        params = {"api-version": "3.0", "to": target}
                        if source != "auto": params["from"] = source
                        headers = {"Ocp-Apim-Subscription-Key": api_key, "Ocp-Apim-Subscription-Region": getattr(settings, "MICROSOFT_TRANSLATOR_REGION", "eastus"), "Content-type": "application/json"}
                        response = requests.post("https://api.cognitive.microsofttranslator.com/translate", params=params, headers=headers, json=[{"text": text}], timeout=15)
                        response.raise_for_status()
                        translated = response.json()[0]["translations"][0]["text"].strip()
                
                # 🛡️ CRITICAL FIX: Reject Google's HTML block page if it slips through as text
                if translated and ("Error 500" in translated or "That’s an error" in translated or "<!DOCTYPE" in translated or "<html" in translated.lower()):
                    logger.warning("⚠️ Translation engine '%s' returned Google block page. Forcing fallback.", eng)
                    translated = None
                
                if translated:
                    break # Success! Stop trying other engines.
            except Exception as exc:
                logger.warning("Translation engine '%s' failed: %s", eng, exc)
                continue

        if translated and localize_terms and target != "en":
            try: translated = force_localize_remaining_words(translated, target)
            except Exception: pass
            
        return translated


# ============================================================
# TEXT TRANSLATION VIEW
# ============================================================

class TranslateView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TranslationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=400)

        data = serializer.validated_data
        user = get_optional_user(request)
        source_text = str(data.get("source_text", "") or "").replace("\x00", "").strip()
        source_lang = normalize_language_code(data.get("source_lang", "auto"))
        target_lang = normalize_language_code(data.get("target_lang", "en"))
        mode = normalize_mode(data.get("mode", "text_to_text"))
        engine = normalize_engine(data.get("engine", "google"))
        localize_terms = data.get("localize_terms", True)
        
        translation_style = data.get("translation_style", "balanced")
        formality_level = data.get("formality_level", "neutral")
        translation_speed = data.get("translation_speed", "standard")
        preserve_formatting = parse_bool(data.get("preserve_formatting", True), True)
        show_original_text = parse_bool(data.get("show_original_text", True), True)
        tts_voice = str(data.get("tts_voice", "") or "").strip()
        auto_detected = parse_bool(data.get("auto_detect", False), False)

        if not source_text: return Response({"success": False, "message": "Empty text"}, status=400)
        if source_lang != "auto" and source_lang not in SUPPORTED_LANGUAGES:
            return Response({"success": False, "message": f"Unsupported source language: {source_lang}"}, status=400)
        if target_lang not in SUPPORTED_LANGUAGES or target_lang == "auto":
            return Response({"success": False, "message": f"Unsupported target language: {target_lang}"}, status=400)

        char_count = len(source_text)
        if user:
            usage_check = check_translation_limit(user, char_count)
            if not usage_check["allowed"]:
                return Response({"success": False, "message": "Monthly translation limit reached.", "usage": usage_check["usage"]}, status=403)

        try:
            translated = TranslationService.translate(text=source_text, source_lang=source_lang, target_lang=target_lang, mode=mode, localize_terms=localize_terms, engine=engine)
        except Exception as exc:
            logger.exception("Translation service error: %s", exc)
            translated = None

        if not translated:
            return Response({"success": False, "message": "Translation service temporarily unavailable."}, status=502)

        history_id = None
        if user:
            try:
                history = TranslationHistory.objects.create(
                    user=user, source_text=source_text, translated_text=translated, source_lang=source_lang,
                    target_lang=target_lang, mode=mode, engine=engine, char_count=char_count,
                    translation_style=translation_style, formality_level=formality_level, translation_speed=translation_speed,
                    preserve_formatting=preserve_formatting, auto_detected=auto_detected, show_original_text=show_original_text, tts_voice=tts_voice,
                )
                history_id = str(history.id)
                save_to_history(user=user, history_type="translate", title=get_mode_display_name(mode),
                    description=f"Translated {char_count} characters from {source_lang} to {target_lang}",
                    source_app="translation", source_model="TranslationHistory", source_id=history_id,
                    metadata={"sourceLang": source_lang, "targetLang": target_lang, "method": get_mode_display_name(mode), "characters": char_count, "engine": engine, "style": translation_style}, status="completed")

                if getattr(user, "translation_complete", True):
                    Notification.objects.create(user=user, title="Translation Complete", message=f"Successfully translated {char_count} characters from {source_lang} to {target_lang}.", type="success", link=f"/history/{history_id}")
                
                if getattr(user, "email_notifications", True):
                    try:
                        from users.email_utils import send_translation_complete_email
                        send_translation_complete_email(to_email=user.email, user_name=user.get_full_name() or user.email.split("@")[0], char_count=char_count, source_lang=source_lang, target_lang=target_lang)
                    except Exception: pass

                if getattr(user, "push_notifications", False):
                    try:
                        from users.push_utils import send_push_notification
                        for sub in user.push_subscriptions.all():
                            send_push_notification(subscription_data={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}, title="Translation Complete! 🎉", message=f"Successfully translated {char_count} characters to {target_lang.upper()}.", url=f"/history/{history_id}")
                    except Exception: pass
            except Exception as exc:
                logger.exception("Translation history operation failed: %s", exc)

            try: update_translation_usage(user, char_count)
            except Exception: pass

        response_data = {
            "translated_text": translated, "char_count": char_count, "history_id": history_id,
            "source_lang": source_lang, "target_lang": target_lang, "mode": mode, "engine": engine, "audio_url": None,
            "translation_style": translation_style, "formality_level": formality_level, "translation_speed": translation_speed,
            "preserve_formatting": preserve_formatting, "auto_detected": auto_detected, "show_original_text": show_original_text, "tts_voice": tts_voice,
        }

        if mode in {"text_to_speech", "speech_to_speech"}:
            try:
                audio_url = self._generate_speech(translated, target_lang, tts_voice=tts_voice)
                if audio_url: response_data["audio_url"] = audio_url
            except Exception as exc:
                logger.exception("TTS generation failed: %s", exc)

        return Response({"success": True, "data": response_data})

    def _generate_speech(self, text, language, tts_voice=None):
        if not text or not str(text).strip(): return None
        clean_text = str(text).replace("\x00", "").strip()
        if len(clean_text) > 200: clean_text = clean_text[:200] + "..."

        temp_path = None
        try:
            filename = f"tts_{uuid.uuid4().hex}.mp3"
            relative_path = f"audio/{filename}"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name

            voice_map = {
                "en": "en-US-GuyNeural", "hi": "hi-IN-MadhurNeural", "es": "es-ES-AlvaroNeural", "fr": "fr-FR-HenriNeural",
                "de": "de-DE-ConradNeural", "it": "it-IT-DiegoNeural", "pt": "pt-BR-AntonioNeural", "ru": "ru-RU-DmitryNeural",
                "ja": "ja-JP-KeitaNeural", "ko": "ko-KR-InJoonNeural", "zh": "zh-CN-YunxiNeural", "ar": "ar-SA-HamedNeural",
                "tr": "tr-TR-AhmetNeural", "nl": "nl-NL-MaartenNeural", "pl": "pl-PL-MarekNeural", "sv": "sv-SE-MattiasNeural",
                "id": "id-ID-ArdiNeural", "vi": "vi-VN-NamMinhNeural", "uk": "uk-UA-OstapNeural", "mr": "mr-IN-AarohiNeural",
                "ta": "ta-IN-ValluvarNeural", "te": "te-IN-MohanNeural", "ml": "ml-IN-MidhunNeural", "bn": "bn-IN-TanishaaNeural", "gu": "gu-IN-NiranjanNeural",
            }
            normalized_language = normalize_language_code(language)
            voice = tts_voice if (tts_voice and "Neural" in str(tts_voice)) else voice_map.get(str(normalized_language).lower(), "en-US-GuyNeural")

            edge_success = False
            try:
                import edge_tts
                async def generate_audio():
                    communicate = edge_tts.Communicate(clean_text, voice)
                    await communicate.save(temp_path)
                asyncio.run(generate_audio())
                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    edge_success = True
                    print(f"✅ Edge TTS succeeded: {voice}")
            except Exception as exc:
                logger.warning("Edge TTS failed: %s", exc)

            if not edge_success:
                try:
                    tts_language = normalize_tts_language(language)
                    tts = gTTS(text=clean_text, lang=tts_language, slow=False)
                    tts.save(temp_path)
                    if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                        return None
                    
                    # 🛡️ CRITICAL FIX: Check if Google returned an HTML block page instead of MP3
                    with open(temp_path, "rb") as f:
                        header = f.read(32)
                        if header.startswith(b"<!DOCTYPE") or header.startswith(b"<html") or b"Error 500" in header:
                            logger.warning("⚠️ gTTS returned Google's HTML block page. Aborting TTS to prevent frontend error.")
                            return None
                    print(f"✅ gTTS fallback succeeded for {tts_language}")
                except Exception as exc:
                    logger.warning("gTTS failed: %s", exc)
                    return None

            if temp_path and os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                with open(temp_path, "rb") as audio_file:
                    saved_name = default_storage.save(relative_path, ContentFile(audio_file.read()))
                return build_media_url(saved_name)
            return None
        except Exception as exc:
            logger.exception("Unexpected TTS error: %s", exc)
            return None
        finally:
            if temp_path and os.path.exists(temp_path):
                try: os.remove(temp_path)
                except Exception: pass


# ============================================================
# SPEECH TO TEXT VIEW
# ============================================================

class SpeechToTextView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        audio_file = request.FILES.get("audio")
        if not audio_file: return Response({"success": False, "message": "No audio file."}, status=400)

        source_lang = normalize_language_code(request.data.get("source_lang", "auto"))
        target_lang = normalize_language_code(request.data.get("target_lang", "en"))
        mode = normalize_mode(request.data.get("mode", "speech_to_text"))
        localize_terms = parse_bool(request.data.get("localize_terms", True), True)
        engine = normalize_engine(request.data.get("engine", "google"))
        
        translation_style = str(request.data.get("translation_style", "balanced") or "balanced")
        formality_level = str(request.data.get("formality_level", "neutral") or "neutral")
        translation_speed = str(request.data.get("translation_speed", "standard") or "standard")
        preserve_formatting = parse_bool(request.data.get("preserve_formatting", True), True)
        show_original_text = parse_bool(request.data.get("show_original_text", True), True)
        tts_voice = str(request.data.get("tts_voice", "") or "").strip()
        auto_detected = parse_bool(request.data.get("auto_detect", False), False)

        if source_lang != "auto" and source_lang not in SUPPORTED_LANGUAGES:
            return Response({"success": False, "message": f"Unsupported source language: {source_lang}"}, status=400)
        if target_lang not in SUPPORTED_LANGUAGES or target_lang == "auto":
            return Response({"success": False, "message": f"Unsupported target language: {target_lang}"}, status=400)

        uploaded_path, wav_path = None, None
        try:
            if int(getattr(audio_file, "size", 0) or 0) < 300:
                return Response({"success": False, "message": "Audio is too small."}, status=400)

            ext = os.path.splitext(getattr(audio_file, "name", "") or "")[1].lower() or ".webm"
            uploaded_path = default_storage.save(f"uploads/audio_{uuid.uuid4().hex}{ext}", ContentFile(audio_file.read()))
            original_full_path = os.path.join(settings.MEDIA_ROOT, uploaded_path)
            
            ffmpeg_path, _ = configure_ffmpeg()
            wav_path = os.path.splitext(original_full_path)[0] + "_converted.wav"
            cmd = [ffmpeg_path, "-y", "-i", original_full_path, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, check=True)

            audio = AudioSegment.from_wav(wav_path)
            if len(audio) < 700: raise RuntimeError("Audio too short.")
            audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)
            audio.export(wav_path, format="wav", parameters=["-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"])

            recognizer = sr.Recognizer()
            recognizer.dynamic_energy_threshold = True
            recognizer.energy_threshold = 250
            recognizer.pause_threshold = 0.8

            with sr.AudioFile(wav_path) as source:
                audio_data = recognizer.record(source)

            explicit_locale = get_speech_locale(source_lang)
            source_text = str(recognizer.recognize_google(audio_data, language=explicit_locale) if explicit_locale else recognizer.recognize_google(audio_data)).replace("\x00", "").strip()

            if not source_text: return Response({"success": False, "message": "No speech detected."}, status=400)

            speech_char_count = len(source_text)
            usage_check = check_translation_limit(request.user, speech_char_count)
            if not usage_check["allowed"]:
                return Response({"success": False, "message": "Monthly translation limit reached.", "usage": usage_check["usage"]}, status=403)

            translated, audio_url = source_text, None
            if mode == "speech_to_speech":
                translated = TranslationService.translate(text=source_text, source_lang=source_lang, target_lang=target_lang, mode=mode, localize_terms=localize_terms, engine=engine)
                if not translated: return Response({"success": False, "message": "Speech translation failed."}, status=502)
                try:
                    audio_url = TranslateView()._generate_speech(translated, target_lang, tts_voice=tts_voice)
                except Exception as exc:
                    logger.warning("Speech TTS failed: %s", exc)
                    audio_url = None

            history = TranslationHistory.objects.create(
                user=request.user, source_text=source_text, translated_text=translated, source_lang=source_lang,
                target_lang=target_lang, mode=mode, engine=engine, char_count=speech_char_count, audio_url=audio_url,
                translation_style=translation_style, formality_level=formality_level, translation_speed=translation_speed,
                preserve_formatting=preserve_formatting, auto_detected=auto_detected, show_original_text=show_original_text, tts_voice=tts_voice,
            )
            history_id = str(history.id)
            save_to_history(user=request.user, history_type="translate", title=get_mode_display_name(mode),
                description=f"Transcribed and translated {speech_char_count} characters from {source_lang} to {target_lang}",
                source_app="translation", source_model="TranslationHistory", source_id=history_id,
                metadata={"sourceLang": source_lang, "targetLang": target_lang, "method": get_mode_display_name(mode), "characters": speech_char_count, "engine": engine}, status="completed")

            if getattr(request.user, "translation_complete", True):
                Notification.objects.create(user=request.user, title="Speech Translation Complete", message=f"Successfully transcribed and translated {speech_char_count} characters.", type="success", link=f"/history/{history_id}")

            try: update_translation_usage(request.user, speech_char_count)
            except Exception: pass

            return Response({
                "success": True, "data": {
                    "source_text": source_text, "translated_text": translated if mode == "speech_to_speech" else "",
                    "audio_url": audio_url, "history_id": history_id, "source_lang": source_lang, "target_lang": target_lang,
                    "mode": mode, "engine": engine, "char_count": speech_char_count, "translation_style": translation_style,
                    "formality_level": formality_level, "translation_speed": translation_speed, "preserve_formatting": preserve_formatting,
                    "auto_detected": auto_detected, "show_original_text": show_original_text, "tts_voice": tts_voice,
                }
            })

        except sr.UnknownValueError:
            return Response({"success": False, "message": "Could not understand the recorded speech."}, status=400)
        except sr.RequestError:
            return Response({"success": False, "message": "Google speech recognition service is unavailable."}, status=502)
        except RuntimeError as exc:
            return Response({"success": False, "message": str(exc)}, status=400)
        except Exception as exc:
            logger.exception("Speech processing failed: %s", exc)
            return Response({"success": False, "message": "Speech processing failed.", "error": str(exc)}, status=500)
        finally:
            if uploaded_path:
                path = os.path.join(settings.MEDIA_ROOT, uploaded_path)
                if os.path.exists(path):
                    try: os.remove(path)
                    except Exception: pass
            if wav_path and os.path.isfile(wav_path):
                try: os.remove(wav_path)
                except Exception: pass


# ============================================================
# OTHER VIEWS (History, Favorites, etc.)
# ============================================================

class DocumentPageTranslateView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    DOCUMENT_MONTHLY_LIMIT = 50000

    def post(self, request):
        user = get_optional_user(request)
        source_text = str(request.data.get("source_text", "") or "").replace("\x00", "").strip()
        source_lang = normalize_language_code(request.data.get("source_lang", "auto") or "auto")
        target_lang = normalize_language_code(request.data.get("target_lang", "en") or "en")
        page_number = request.data.get("page_number", 1)

        if not source_text: return Response({"success": False, "message": "No readable text."}, status=400)
        try: page_number = max(int(page_number), 1)
        except Exception: page_number = 1

        if source_lang != "auto" and source_lang not in SUPPORTED_LANGUAGES:
            return Response({"success": False, "message": f"Unsupported source language: {source_lang}"}, status=400)
        if target_lang not in SUPPORTED_LANGUAGES or target_lang == "auto":
            return Response({"success": False, "message": f"Unsupported target language: {target_lang}"}, status=400)

        char_count = len(source_text)
        if user:
            current_usage = int(getattr(user, "monthly_translation_chars", 0) or 0)
            if not is_premium_user(user) and (current_usage + char_count) > self.DOCUMENT_MONTHLY_LIMIT:
                return Response({"success": False, "message": "Limit reached"}, status=403)

        translated = TranslationService.translate(text=source_text, source_lang=source_lang, target_lang=target_lang, mode="text_to_text", localize_terms=False, engine="google")
        if not translated: return Response({"success": False, "message": "Translation failed"}, status=502)

        if user and not is_premium_user(user):
            try: update_translation_usage(user, char_count)
            except Exception: pass

        if user:
            try:
                history = TranslationHistory.objects.create(user=user, source_text=source_text, translated_text=translated, source_lang=source_lang, target_lang=target_lang, mode="text_to_text", engine="google", char_count=char_count)
                history_id = str(history.id)
                save_to_history(user=user, history_type="translate", title="Document Translation", description=f"Translated page {page_number} from {source_lang} to {target_lang}", source_app="translation", source_model="DocumentPageTranslate", source_id=history_id, metadata={"sourceLang": source_lang, "targetLang": target_lang, "method": "Document Translation", "characters": char_count, "page_number": page_number}, status="completed")
                if getattr(user, "translation_complete", True):
                    Notification.objects.create(user=user, title="Document Translation Complete", message=f"Successfully translated page {page_number} ({char_count} characters).", type="success", link=f"/history/{history_id}")
            except Exception as exc:
                logger.warning("Document history save failed: %s", exc)

        return Response({"success": True, "data": {"translated_text": translated, "source_lang": source_lang, "target_lang": target_lang, "page_number": page_number, "char_count": char_count}})

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def language_list(request):
    popular = request.query_params.get("popular", "false").lower() == "true"
    queryset = Language.objects.filter(is_active=True).order_by("sort_order", "name")
    if popular: queryset = queryset.filter(is_popular=True)
    return Response({"success": True, "count": queryset.count(), "data": LanguageSerializer(queryset, many=True).data})

class HistoryListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        mode = request.query_params.get("mode")
        is_fav = request.query_params.get("is_favorite")
        qs = TranslationHistory.objects.filter(user=request.user).order_by("-created_at")
        if mode: qs = qs.filter(mode=normalize_mode(mode))
        if is_fav is not None: qs = qs.filter(is_favorite=(is_fav.lower() == "true"))
        try: page = max(int(request.query_params.get("page", 1)), 1)
        except Exception: page = 1
        try: page_size = min(max(int(request.query_params.get("page_size", 20)), 1), 100)
        except Exception: page_size = 20
        start, end = (page - 1) * page_size, page * page_size
        return Response({"success": True, "total": qs.count(), "page": page, "page_size": page_size, "data": TranslationHistorySerializer(qs[start:end], many=True).data})

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def toggle_favorite_history(request, pk):
    try:
        history = TranslationHistory.objects.get(pk=pk, user=request.user)
        history.is_favorite = not history.is_favorite
        history.save(update_fields=["is_favorite"])
        if history.is_favorite:
            FavoriteTranslation.objects.get_or_create(user=request.user, source_text=history.source_text, source_lang=history.source_lang, target_lang=history.target_lang, defaults={"translated_text": history.translated_text, "title": history.source_text[:50]})
        else:
            FavoriteTranslation.objects.filter(user=request.user, source_text=history.source_text, source_lang=history.source_lang, target_lang=history.target_lang).delete()
        return Response({"success": True, "is_favorite": history.is_favorite})
    except TranslationHistory.DoesNotExist:
        return Response({"success": False, "message": "History not found."}, status=404)
    except Exception as exc:
        logger.exception("Toggle favorite failed: %s", exc)
        return Response({"success": False, "error": str(exc)}, status=500)

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_history(request, pk):
    try:
        TranslationHistory.objects.get(pk=pk, user=request.user).delete()
        return Response({"success": True})
    except TranslationHistory.DoesNotExist:
        return Response({"success": False, "message": "History not found."}, status=404)

class FavoriteListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        qs = FavoriteTranslation.objects.filter(user=request.user).order_by("-created_at")
        folder = request.query_params.get("folder")
        if folder: qs = qs.filter(folder=folder)
        return Response({"success": True, "count": qs.count(), "data": FavoriteTranslationSerializer(qs, many=True).data})
    def post(self, request):
        serializer = FavoriteTranslationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"success": True, "data": serializer.data}, status=201)
        return Response({"success": False, "errors": serializer.errors}, status=400)

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_favorite(request, pk):
    try:
        FavoriteTranslation.objects.get(pk=pk, user=request.user).delete()
        return Response({"success": True})
    except FavoriteTranslation.DoesNotExist:
        return Response({"success": False, "message": "Favorite not found."}, status=404)

class SpeechProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        profiles = SpeechProfile.objects.filter(user=request.user).order_by("-is_default", "-created_at")
        return Response({"success": True, "data": SpeechProfileSerializer(profiles, many=True).data})
    def post(self, request):
        serializer = SpeechProfileSerializer(data=request.data)
        if serializer.is_valid():
            if request.data.get("is_default"):
                SpeechProfile.objects.filter(user=request.user).update(is_default=False)
            serializer.save(user=request.user)
            return Response({"success": True, "data": serializer.data}, status=201)
        return Response({"success": False, "errors": serializer.errors}, status=400)