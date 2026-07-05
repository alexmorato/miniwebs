#!/usr/bin/env python3
"""Normalize wrapped dictionary entries to one definition per line.

Example:
	python transform_1word_1line.py assets/dictionary_ES.md -o assets/dictionary_ES_fixed.md
	python transform_1word_1line.py assets/dictionary_ES.md --inplace
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ABBREVIATION_HEADS = {
	"adj",
	"adv",
	"amb",
	"amer",
	"arg",
	"astr",
	"biol",
	"cap",
	"chile",
	"col",
	"com",
	"conj",
	"cu",
	"ecuad",
	"fig",
	"fam",
	"f",
	"fr",
	"guat",
	"hond",
	"intr",
	"interj",
	"loc",
	"m",
	"mex",
	"nic",
	"pan",
	"par",
	"per",
	"prep",
	"prnl",
	"pron",
	"rdom",
	"s",
	"tr",
	"ur",
	"urug",
	"v",
}

POS_START_RE = re.compile(
	r"^(adj|adv|amb|com|f|intr|interj|m|prep|prnl|pronombre|s|tr|v)(?:\\.|\\b)",
	re.IGNORECASE,
)


def normalize_token(token: str) -> str:
	return re.sub(r"[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]", "", token).lower()


def looks_like_entry_start(line: str) -> bool:
	s = line.strip()
	if not s:
		return False

	split_match = re.match(r"^(.{1,50}?)(?:\.\s+|\s+)(.+)$", s)
	if not split_match:
		return False

	head, rest = split_match.groups()
	head_tokens = head.split()

	if not head_tokens or len(head_tokens) > 4:
		return False

	first_norm = normalize_token(head_tokens[0])
	if first_norm in ABBREVIATION_HEADS:
		return False

	if POS_START_RE.match(rest):
		return True

	if ". " in s[:80] and re.match(r"^[A-ZÁÉÍÓÚÜÑ¡¿]", rest):
		return True

	return False


def merge_wrapped_definitions(lines: list[str]) -> list[str]:
	out: list[str] = []
	current = ""

	for raw_line in lines:
		line = raw_line.rstrip("\n")
		stripped = line.strip()

		if not stripped:
			if current:
				out.append(current)
				current = ""
			out.append("")
			continue

		if not current:
			current = stripped
			continue

		if looks_like_entry_start(stripped):
			out.append(current)
			current = stripped
		else:
			current = f"{current} {stripped}"

	if current:
		out.append(current)

	return out


def process_file(input_path: Path, output_path: Path) -> None:
	# utf-8-sig tolerates files saved with BOM by PowerShell Set-Content.
	text = input_path.read_text(encoding="utf-8-sig")
	lines = text.splitlines()
	merged = merge_wrapped_definitions(lines)
	output = "\n".join(merged) + "\n"
	output_path.write_text(output, encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(
		description="Une líneas partidas de definiciones en un diccionario Markdown."
	)
	parser.add_argument("input", type=Path, help="Ruta al fichero .md de entrada")
	parser.add_argument(
		"-o",
		"--output",
		type=Path,
		help="Ruta de salida (si no se indica, usa <entrada>.fixed.md)",
	)
	parser.add_argument(
		"--inplace",
		action="store_true",
		help="Sobrescribe el fichero de entrada",
	)
	return parser


def main() -> None:
	parser = build_parser()
	args = parser.parse_args()

	input_path: Path = args.input
	if not input_path.exists():
		raise FileNotFoundError(f"No existe el fichero: {input_path}")

	if args.inplace and args.output:
		raise ValueError("No puedes usar --inplace y --output a la vez")

	if args.inplace:
		output_path = input_path
	elif args.output:
		output_path = args.output
	else:
		output_path = input_path.with_name(f"{input_path.stem}.fixed{input_path.suffix}")

	process_file(input_path, output_path)
	print(f"OK: {input_path} -> {output_path}")


if __name__ == "__main__":
	main()
