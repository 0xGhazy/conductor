class StageSkipped(Exception):
    """Raised by a stage that doesn't apply (e.g. a disabled feature). Reported as skipped, not failed."""
