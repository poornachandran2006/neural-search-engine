import pytest
from app.services.retrieval.fusion import reciprocal_rank_fusion


def _make_chunk(id: int, text: str = "text") -> dict:
    return {"id": id, "text": text, "source_file": "test.pdf"}


# ─── Basic correctness ────────────────────────────────────────────────────────

def test_empty_both_lists():
    result = reciprocal_rank_fusion([], [])
    assert result == []


def test_empty_dense_only_sparse():
    sparse = [_make_chunk(1), _make_chunk(2)]
    result = reciprocal_rank_fusion([], sparse, k=60)
    assert len(result) == 2


def test_empty_sparse_only_dense():
    dense = [_make_chunk(1), _make_chunk(2)]
    result = reciprocal_rank_fusion(dense, [], k=60)
    assert len(result) == 2


def test_no_overlap_union_of_both():
    dense = [_make_chunk(1), _make_chunk(2)]
    sparse = [_make_chunk(3), _make_chunk(4)]
    result = reciprocal_rank_fusion(dense, sparse, k=60)
    ids = {c["id"] for c in result}
    assert ids == {1, 2, 3, 4}


def test_full_overlap_deduplicates():
    chunks = [_make_chunk(1), _make_chunk(2), _make_chunk(3)]
    result = reciprocal_rank_fusion(chunks, chunks, k=60)
    ids = [c["id"] for c in result]
    assert len(ids) == len(set(ids))  # no duplicates


# ─── Scoring correctness ──────────────────────────────────────────────────────

def test_rrf_score_attached_to_each_chunk():
    dense = [_make_chunk(1)]
    result = reciprocal_rank_fusion(dense, [], k=60)
    assert "rrf_score" in result[0]
    assert isinstance(result[0]["rrf_score"], float)


def test_rank1_in_both_lists_gets_highest_score():
    # chunk id=1 is rank 1 in both → highest combined score
    dense = [_make_chunk(1), _make_chunk(2), _make_chunk(3)]
    sparse = [_make_chunk(1), _make_chunk(4), _make_chunk(5)]
    result = reciprocal_rank_fusion(dense, sparse, k=60)
    assert result[0]["id"] == 1


def test_rrf_score_formula_correct():
    # chunk id=1, rank=1 in dense only
    # expected score = 1 / (60 + 1) = 0.016393...
    dense = [_make_chunk(1)]
    result = reciprocal_rank_fusion(dense, [], k=60)
    expected = 1.0 / (60 + 1)
    assert abs(result[0]["rrf_score"] - expected) < 1e-9


def test_rrf_score_doubles_when_in_both_lists():
    # chunk id=1 rank=1 in both
    # expected score = 1/(60+1) + 1/(60+1) = 2/(61)
    dense = [_make_chunk(1)]
    sparse = [_make_chunk(1)]
    result = reciprocal_rank_fusion(dense, sparse, k=60)
    expected = 2.0 / (60 + 1)
    assert abs(result[0]["rrf_score"] - expected) < 1e-9


def test_sorted_descending_by_rrf_score():
    dense = [_make_chunk(1), _make_chunk(2), _make_chunk(3)]
    sparse = [_make_chunk(3), _make_chunk(2), _make_chunk(1)]
    result = reciprocal_rank_fusion(dense, sparse, k=60)
    scores = [c["rrf_score"] for c in result]
    assert scores == sorted(scores, reverse=True)


# ─── k parameter ─────────────────────────────────────────────────────────────

def test_custom_k_affects_score():
    dense = [_make_chunk(1)]
    result_k60 = reciprocal_rank_fusion(dense, [], k=60)
    result_k1 = reciprocal_rank_fusion(dense, [], k=1)
    # k=1 gives higher score than k=60 for rank 1
    assert result_k1[0]["rrf_score"] > result_k60[0]["rrf_score"]


# ─── Metadata preservation ────────────────────────────────────────────────────

def test_dense_metadata_preserved_for_overlap():
    # When a chunk appears in both lists, dense metadata should be kept
    dense_chunk = {"id": 1, "text": "from dense", "source_file": "dense.pdf"}
    sparse_chunk = {"id": 1, "text": "from sparse", "source_file": "sparse.pdf"}
    result = reciprocal_rank_fusion([dense_chunk], [sparse_chunk], k=60)
    assert result[0]["source_file"] == "dense.pdf"