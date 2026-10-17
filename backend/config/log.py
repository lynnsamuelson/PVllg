"""The app's logging wrapper. Get loggers with get_logger(__name__), never from a logging library
directly, so swapping libraries later only touches this file and LOGGING in settings.py.

Sentry: sentry_sdk.init() in settings.py picks up these loggers through its logging integration.
"""
import logging


def get_logger(name):
    return logging.getLogger(name)
