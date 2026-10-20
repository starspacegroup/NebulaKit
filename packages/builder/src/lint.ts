/**
 * Checks a page for things that make it worse for visitors, without stopping
 * the author from saving. Each issue names the block it is about so the editor
 * can jump to it.
 *
 * These are the rules that need only the document. Colour contrast is not
 * here: it depends on the site's theme, and the theme tokens are already held
 * to WCAG by `bun run validate:contrast`.
 */
import { walk } from './ops';
import { BREAKPOINTS, BLOCK_LIBRARY, type Block, type PageDocument } from './schema';

export interface LintIssue {
	blockId: string;
	rule: string;
	severity: 'warning' | 'info';
	message: string;
}

/** Link text that says nothing when read out of context, as a screen-reader user hears it. */
const VAGUE_LINK = /^(click here|here|read more|more|learn more|link|this)$/i;

export function lintDocument(doc: PageDocument): LintIssue[] {
	const issues: LintIssue[] = [];
	const add = (block: Block, rule: string, severity: LintIssue['severity'], message: string) =>
		issues.push({ blockId: block.id, rule, severity, message });
	let previousLevel = 0;
	let h1s = 0;

	walk(doc.blocks, (block) => {
		const name = BLOCK_LIBRARY[block.type].label;
		if (block.hide && BREAKPOINTS.every((b) => block.hide?.includes(b)))
			add(
				block,
				'hidden-everywhere',
				'warning',
				`${name} is hidden on every screen size, so no one sees it.`
			);

		switch (block.type) {
			case 'image':
				if (!block.props.src)
					add(block, 'image-empty', 'warning', 'Image has no picture chosen yet.');
				else if (!block.props.alt.trim())
					add(
						block,
						'image-alt',
						'warning',
						'Image has no description. Add one, or people using a screen reader miss it.'
					);
				break;
			case 'heading': {
				const level = block.props.level;
				if (level === 1 && ++h1s > 1)
					add(block, 'heading-h1', 'warning', 'A page should have one Heading 1.');
				if (previousLevel && level > previousLevel + 1)
					add(
						block,
						'heading-order',
						'warning',
						`Heading ${level} follows Heading ${previousLevel}. Do not skip a level.`
					);
				previousLevel = level;
				break;
			}
			case 'text':
				if (!block.props.text.trim()) add(block, 'text-empty', 'info', 'Text block is empty.');
				break;
			case 'button':
				if (VAGUE_LINK.test(block.props.label.trim()))
					add(
						block,
						'link-vague',
						'warning',
						`“${block.props.label}” does not say where the link goes.`
					);
				break;
			case 'section':
			case 'column':
				if (!block.children?.length) add(block, 'container-empty', 'info', `${name} is empty.`);
				break;
		}
	});
	return issues;
}
