from parser import DrainParser


def test_parser_initialization():
    parser = DrainParser(sim_th=0.5, max_children=50)
    assert parser.config.drain_sim_th == 0.5
    assert parser.config.drain_max_children == 50


def test_parser_masking_instructions():
    masking = [
        {"pattern": r"\d+", "label": "NUM", "enabled": True},
        {"pattern": r"0x[0-9a-f]+", "label": "HEX", "enabled": False},  # Disabled
        {"pattern": "[invalid regex", "label": "BAD", "enabled": True},  # Invalid
        "not a dict",  # Should be ignored
    ]
    parser = DrainParser(masking_instructions=masking)
    # Only the first one should be added
    assert len(parser.config.masking_instructions) == 1
    assert parser.config.masking_instructions[0].mask_with == "NUM"


def test_parse_logic():
    parser = DrainParser()
    res1 = parser.parse("Connected to 192.168.1.1")
    res2 = parser.parse("Connected to 192.168.1.2")

    assert res1["cluster_id"] == res2["cluster_id"]
    assert "Connected to" in res1["template"]
    assert res1["change_type"] in ["cluster_created", "cluster_template_changed"]
    assert res2["change_type"] in ["none", "cluster_count_changed", "cluster_template_changed"]


def test_get_clusters():
    parser = DrainParser()
    parser.parse("User admin logged in")
    parser.parse("User guest logged in")
    clusters = parser.get_clusters()
    assert len(clusters) == 1
    assert "User" in clusters[0].get_template()


def test_persistence(tmp_path):
    persist_file = tmp_path / "drain.bin"
    parser = DrainParser(persistence_path=str(persist_file))
    parser.parse("Message 1")
    parser.save()

    assert persist_file.exists()

    # Reload from persistence
    parser2 = DrainParser(persistence_path=str(persist_file))
    assert len(parser2.get_clusters()) == 1


def test_persistence_no_path():
    parser = DrainParser(persistence_path=None)
    parser.parse("Test")
    parser.save()  # Should not raise
    assert parser.persistence is None
