import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNumberLabel, renumberChanges, superscript, UNNUMBERED } from '../src/numbers';

const link = (text: string, note: string) => `[${text}](obsidian://cite?note=${encodeURIComponent(note)}&q=a)`;

test('writes numbers in superscript digits', () => {
	assert.equal(superscript(1), '¹');
	assert.equal(superscript(12), '¹²');
	assert.ok(isNumberLabel('¹²'));
	assert.ok(isNumberLabel(UNNUMBERED));
	assert.ok(!isNumberLabel('Smith, 2020'));
});

test('numbers the cited notes in order of first appearance', () => {
	const text = [
		`First${link('⁰', 'Course 3')} and a work (${'[Smith, 2020](obsidian://cite?note=Smith&q=b)'}).`,
		`Then${link('⁵', 'Field notes')}, again${link('⁰', 'Course 3')}.`,
		'```',
		link('⁰', 'In code'),
		'```',
	].join('\n');
	const changes = renumberChanges(text, (l) => l.target.note ?? null);
	const result = changes.reduceRight((t, c) => t.slice(0, c.from) + c.text + t.slice(c.to), text);
	assert.ok(result.includes(link('¹', 'Course 3')));
	assert.ok(result.includes(link('²', 'Field notes')));
	assert.equal(result.split(link('¹', 'Course 3')).length - 1, 2);
	// APA citations and links in code are left alone.
	assert.ok(result.includes('[Smith, 2020]'));
	assert.ok(result.includes(link('⁰', 'In code')));
	// Already in order: nothing to change.
	assert.deepEqual(renumberChanges(result, (l) => l.target.note ?? null), []);
});
