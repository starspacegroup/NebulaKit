import { describe, expect, it } from 'vitest';
import {
	addActiveFilter,
	applyColumnFilters,
	ariaSort,
	chipLabel,
	csvField,
	cycleSort,
	filterValue,
	gridView,
	pruneSelection,
	removeActiveFilter,
	resultCount,
	selectedText,
	setColumnFilter,
	sortAnnouncement,
	sortMulti,
	sortPriority,
	toColumnFilters,
	toCsv,
	unusedDefs,
	type FilterDef,
	type GridSort
} from './logic';

const rows = [
	{ id: 1, name: 'Ada', team: 'Eng', age: 36, city: 'London' },
	{ id: 2, name: 'Alan', team: 'Eng', age: 41, city: 'Wilmslow' },
	{ id: 3, name: 'Grace', team: 'Ops', age: 85, city: 'New York' },
	{ id: 4, name: 'Barbara', team: 'Ops', age: 36, city: 'LA' },
	{ id: 5, name: 'Edsger', team: 'Eng', age: 36, city: '' }
];

describe('cycleSort', () => {
	it('cycles a single column asc, desc, off', () => {
		let s = cycleSort([], 'name');
		expect(s).toEqual([{ key: 'name', direction: 'ascending' }]);
		s = cycleSort(s, 'name');
		expect(s).toEqual([{ key: 'name', direction: 'descending' }]);
		s = cycleSort(s, 'name');
		expect(s).toEqual([]);
	});
	it('a plain press on another column replaces the list', () => {
		const s = cycleSort([{ key: 'name', direction: 'descending' }], 'age');
		expect(s).toEqual([{ key: 'age', direction: 'ascending' }]);
	});
	it('a plain press with several sorts restarts at the pressed column', () => {
		const multi: GridSort[] = [
			{ key: 'a', direction: 'ascending' },
			{ key: 'b', direction: 'ascending' }
		];
		expect(cycleSort(multi, 'a')).toEqual([{ key: 'a', direction: 'ascending' }]);
	});
	it('additive presses append, flip, then remove', () => {
		let s = cycleSort([{ key: 'team', direction: 'ascending' }], 'age', true);
		expect(s.map((x) => x.key)).toEqual(['team', 'age']);
		s = cycleSort(s, 'age', true);
		expect(s[1].direction).toBe('descending');
		expect(s[0].direction).toBe('ascending');
		s = cycleSort(s, 'age', true);
		expect(s).toEqual([{ key: 'team', direction: 'ascending' }]);
	});
});

describe('aria-sort helpers', () => {
	const s: GridSort[] = [
		{ key: 'team', direction: 'descending' },
		{ key: 'age', direction: 'ascending' }
	];
	it('reports direction or none', () => {
		expect(ariaSort(s, 'team')).toBe('descending');
		expect(ariaSort(s, 'age')).toBe('ascending');
		expect(ariaSort(s, 'name')).toBe('none');
	});
	it('reports priority', () => {
		expect(sortPriority(s, 'team')).toBe(1);
		expect(sortPriority(s, 'age')).toBe(2);
		expect(sortPriority(s, 'x')).toBe(0);
	});
	it('words the announcement', () => {
		expect(sortAnnouncement([])).toBe('Sorting cleared.');
		expect(sortAnnouncement(s, (k) => k.toUpperCase())).toBe(
			'Sorted by TEAM descending, then AGE ascending.'
		);
		expect(sortAnnouncement([s[0]])).toBe('Sorted by team descending.');
	});
});

describe('sortMulti', () => {
	it('uses later columns to break ties', () => {
		const out = sortMulti(rows, [
			{ key: 'age', direction: 'ascending' },
			{ key: 'name', direction: 'descending' }
		]);
		expect(out.map((r) => r.name)).toEqual(['Edsger', 'Barbara', 'Ada', 'Alan', 'Grace']);
	});
	it('returns a copy and leaves the input alone', () => {
		const out = sortMulti(rows, []);
		expect(out).not.toBe(rows);
		expect(out).toEqual(rows);
	});
	it('sorts missing values last', () => {
		const out = sortMulti(rows, [{ key: 'city', direction: 'ascending' }]);
		expect(out[out.length - 1].name).toBe('Edsger');
	});
});

describe('column filters', () => {
	it('matches contains case-insensitively and equals exactly', () => {
		expect(applyColumnFilters(rows, [{ key: 'name', value: 'AL' }]).map((r) => r.id)).toEqual([2]);
		expect(
			applyColumnFilters(rows, [{ key: 'team', value: 'eng', op: 'equals' }]).map((r) => r.id)
		).toEqual([1, 2, 5]);
		expect(applyColumnFilters(rows, [{ key: 'team', value: 'en', op: 'equals' }])).toEqual([]);
	});
	it('ANDs filters and ignores blank ones', () => {
		const out = applyColumnFilters(rows, [
			{ key: 'team', value: 'Eng', op: 'equals' },
			{ key: 'age', value: '36', op: 'equals' },
			{ key: 'name', value: '   ' }
		]);
		expect(out.map((r) => r.id)).toEqual([1, 5]);
		expect(applyColumnFilters(rows, [])).toEqual(rows);
	});
	it('accepts a custom text getter', () => {
		const out = applyColumnFilters(
			rows,
			[{ key: 'age', value: 'years' }],
			(r, k) => `${r[k as keyof typeof r]} years`
		);
		expect(out).toHaveLength(5);
	});
	it('sets, replaces and removes a column filter', () => {
		let f = setColumnFilter([], { key: 'team', value: 'Eng' });
		expect(f).toHaveLength(1);
		f = setColumnFilter(f, { key: 'team', value: 'Ops' });
		expect(f).toEqual([{ key: 'team', value: 'Ops' }]);
		expect(filterValue(f, 'team')).toBe('Ops');
		f = setColumnFilter(f, { key: 'team', value: ' ' });
		expect(f).toEqual([]);
		expect(filterValue(f, 'team')).toBe('');
	});
});

describe('gridView', () => {
	it('searches, filters, sorts and pages', () => {
		const v = gridView(rows, {
			query: '',
			searchKeys: ['name', 'city'],
			filters: [{ key: 'team', value: 'Eng', op: 'equals' }],
			sorts: [{ key: 'name', direction: 'descending' }],
			page: 1,
			pageSize: 2
		});
		expect(v.count).toBe(3);
		expect(v.pageRows.map((r) => r.name)).toEqual(['Edsger', 'Alan']);
		expect(v.slice.pageCount).toBe(2);
	});
	it('defaults to every column and one page', () => {
		const v = gridView(rows, {});
		expect(v.pageRows).toHaveLength(5);
		expect(v.slice.pageCount).toBe(1);
		expect(gridView([], { query: 'x' }).count).toBe(0);
		expect(gridView(rows, { query: 'wilm', searchKeys: ['city'] }).count).toBe(1);
	});
	it('clamps an out-of-range page', () => {
		const v = gridView(rows, { page: 99, pageSize: 2 });
		expect(v.slice.page).toBe(3);
		expect(v.pageRows).toHaveLength(1);
	});
});

describe('wording', () => {
	it('counts results', () => {
		expect(resultCount(0)).toBe('No results');
		expect(resultCount(1)).toBe('1 result');
		expect(resultCount(7)).toBe('7 results');
		expect(resultCount(2, 'row', 'rows')).toBe('2 rows');
		expect(resultCount(0, 'row', 'rows')).toBe('No rows');
	});
	it('words the selection', () => {
		expect(selectedText(0)).toBe('');
		expect(selectedText(3)).toBe('3 selected');
	});
	it('prunes a selection', () => {
		expect(pruneSelection([1, 2, 9], [1, 2, 3])).toEqual([1, 2]);
	});
});

describe('csv', () => {
	it('quotes commas, quotes and newlines', () => {
		expect(csvField('a,b')).toBe('"a,b"');
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
		expect(csvField('line\nbreak')).toBe('"line\nbreak"');
		expect(csvField('plain')).toBe('plain');
		expect(csvField(null)).toBe('');
		expect(csvField(42)).toBe('42');
	});
	it('defuses formulas but keeps negative numbers', () => {
		expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
		expect(csvField('+1')).toBe("'+1");
		expect(csvField('@cmd')).toBe("'@cmd");
		expect(csvField('-cmd')).toBe("'-cmd");
		expect(csvField('-12.5')).toBe('-12.5');
		expect(csvField('\tx')).toContain("'");
	});
	it('writes a header and CRLF rows', () => {
		const csv = toCsv(
			rows.slice(0, 2),
			[
				{ key: 'name', label: 'Name' },
				{ key: 'city', label: 'City, state' }
			],
			(r, k) => r[k as keyof typeof r]
		);
		expect(csv).toBe('Name,"City, state"\r\nAda,London\r\nAlan,Wilmslow');
	});
	it('uses the default getter', () => {
		expect(toCsv([{ a: 1 }], [{ key: 'a', label: 'A' }])).toBe('A\r\n1');
		expect(toCsv([], [{ key: 'a', label: 'A' }])).toBe('A');
	});
});

describe('filter bar', () => {
	const defs: FilterDef[] = [
		{ key: 'team', label: 'Team', options: [{ value: 'eng', label: 'Engineering' }] },
		{ key: 'name', label: 'Name' }
	];
	it('adds, replaces and refuses blank', () => {
		let a = addActiveFilter([], { key: 'team', value: 'eng' });
		a = addActiveFilter(a, { key: 'name', value: ' ada ' });
		expect(a).toEqual([
			{ key: 'team', value: 'eng' },
			{ key: 'name', value: 'ada' }
		]);
		a = addActiveFilter(a, { key: 'team', value: 'ops' });
		expect(a.find((f) => f.key === 'team')?.value).toBe('ops');
		const same = addActiveFilter(a, { key: 'name', value: '  ' });
		expect(same).toEqual(a);
		expect(same).not.toBe(a);
	});
	it('removes and lists unused defs', () => {
		const a = [{ key: 'team', value: 'eng' }];
		expect(unusedDefs(defs, a).map((d) => d.key)).toEqual(['name']);
		expect(removeActiveFilter(a, 'team')).toEqual([]);
	});
	it('words chips', () => {
		expect(chipLabel(defs, { key: 'team', value: 'eng' })).toBe('Team: Engineering');
		expect(chipLabel(defs, { key: 'team', value: 'zzz' })).toBe('Team: zzz');
		expect(chipLabel(defs, { key: 'name', value: 'ada' })).toBe('Name: ada');
		expect(chipLabel(defs, { key: 'ghost', value: 'x' })).toBe('ghost: x');
	});
	it('converts to column filters', () => {
		expect(
			toColumnFilters(defs, [
				{ key: 'team', value: 'eng' },
				{ key: 'name', value: 'a' },
				{ key: 'ghost', value: 'x' }
			])
		).toEqual([
			{ key: 'team', value: 'eng', op: 'equals' },
			{ key: 'name', value: 'a', op: 'contains' },
			{ key: 'ghost', value: 'x', op: 'contains' }
		]);
	});
});
