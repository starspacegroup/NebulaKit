import { definePage } from '../../../define';

/** Example content. Example Co. is not a real business; replace this page. */
export default definePage({
	family: 'what',
	slug: 'tune-ups',
	name: 'Tune-ups',
	title: 'Bike tune-ups: what is included | Example Co.',
	description:
		'Example Co. placeholder service page: a tune-up described step by step. Not a real business or price list.',
	h1: 'What a tune-up includes',
	lede: 'Placeholder text from Example Co. A service page lists what the customer gets, so they can compare it with another shop.',
	blurb: 'Each step of a tune-up, listed.',
	sectionsHeading: 'What we do in a tune-up',
	sections: [
		{
			heading: 'Gears and brakes adjusted',
			body: 'List the adjustments the shop really makes, in the order it makes them.'
		},
		{
			heading: 'Wheels checked',
			body: 'Say what "checked" means here: trued, spokes tensioned, hubs inspected, or not.'
		},
		{
			heading: 'What costs extra',
			body: 'Parts and extra work are usually separate. Say how the shop tells the customer before charging.'
		}
	],
	faq: [
		{
			question: 'How long does a tune-up take?',
			answer: 'Example answer. Give the real usual time, and say when it runs longer.'
		},
		{
			question: 'What does it cost?',
			answer:
				'Example answer. Write the real price here, and add the exact phrase to verifiedNumbers once checked.'
		},
		{
			question: 'Do you clean the bike?',
			answer: 'Example answer. Say what cleaning is included, if any.'
		}
	],
	serviceType: 'Bicycle repair'
});
