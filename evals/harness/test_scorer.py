from __future__ import annotations

from .scorer import extract_answer, normalize_version, score


def test_normalize_version():
    assert normalize_version("15") == "15"
    assert normalize_version("Android 15") == "15"
    assert normalize_version("android 15") == "15"
    assert normalize_version("  Android 15  ") == "15"
    assert normalize_version("14") == "14"


def test_extract_answer_last_occurrence_wins():
    transcript_single = "some output\nCLAWPERATOR_EVAL_ANSWER: 15\nmore output"
    assert extract_answer(transcript_single) == "15"

    transcript_multi = "CLAWPERATOR_EVAL_ANSWER: 14\nlater...\nCLAWPERATOR_EVAL_ANSWER: 15"
    assert extract_answer(transcript_multi) == "15"

    transcript_none = "no answer here"
    assert extract_answer(transcript_none) is None


def test_score_pass():
    result = score("CLAWPERATOR_EVAL_ANSWER: Android 15\n", "15")
    assert result.answer_correct is True
    assert result.answer_normalized == "15"
    assert result.answer_extracted_raw == "Android 15"


def test_score_fail():
    result = score("CLAWPERATOR_EVAL_ANSWER: 14\n", "15")
    assert result.answer_correct is False


def test_score_no_answer():
    result = score("no answer", "15")
    assert result.answer_correct is False
    assert result.answer_extracted_raw is None


def test_extract_answer_malformed_marker_no_value():
    transcript_malformed = "CLAWPERATOR_EVAL_ANSWER:\n"
    assert extract_answer(transcript_malformed) is None


def test_extract_answer_whitespace_only():
    transcript_whitespace_only = "CLAWPERATOR_EVAL_ANSWER:   \n"
    assert extract_answer(transcript_whitespace_only) is None


def test_extract_answer_inside_json_blob_does_not_match():
    transcript_inside_json = '{"output": "CLAWPERATOR_EVAL_ANSWER: 15"}'
    assert extract_answer(transcript_inside_json) is None


def test_extract_answer_line_start_inside_multiline_string_matches():
    transcript_linestart = "some output\nCLAWPERATOR_EVAL_ANSWER: 15\nmore output"
    assert extract_answer(transcript_linestart) == "15"


def test_extract_answer_multiword_answer_is_captured():
    transcript_multiword = "CLAWPERATOR_EVAL_ANSWER: Android 15\n"
    assert extract_answer(transcript_multiword) == "Android 15"


def test_extract_answer_trailing_whitespace_is_stripped():
    transcript_trailing = "CLAWPERATOR_EVAL_ANSWER: 15   \n"
    assert extract_answer(transcript_trailing) == "15"

