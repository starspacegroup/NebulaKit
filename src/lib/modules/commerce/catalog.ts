import type { ModuleEntry } from '../types';

const group = 'Commerce' as const;

export const commerceModules: ModuleEntry[] = [
	{
		id: 'billing-overview',
		name: 'BillingOverview',
		group,
		summary:
			'The current plan, its price, the renewal date and usage meters, with upgrade and cancel actions. Cancelling asks first.',
		a11y: 'A labelled section with a definition list; the status is a badge with words; renewal is a <time>. Past-due and ending-soon notices are alerts. Cancel opens an alertdialog that focuses "Keep plan" first.',
		code: `import { BillingOverview } from '$lib/modules';

<BillingOverview
  plan={{ name: 'Pro', priceCents: 2900, interval: 'month' }}
  renewsAt="2026-11-01T00:00:00Z"
  meters={[{ id: 'api', label: 'API calls', used: 8400, limit: 10000 }]}
  on:upgrade={openPlans}
  on:cancel={cancelPlan}
/>`
	},
	{
		id: 'usage-meters',
		name: 'UsageMeters',
		group,
		summary:
			'Quota bars with limits, a near-limit warning, an overage state and the reset date. A null limit means unlimited.',
		a11y: 'Each bar is role="meter" with min, max, now and a text value ("8,400 of 10,000 API calls. Near limit"). State is written as text with an icon, and an overage is also striped, never colour alone.',
		code: `import { UsageMeters } from '$lib/modules';

<UsageMeters
  meters={[{ id: 'seats', label: 'Seats', used: 12, limit: 10, unit: 'seats' }]}
  warnAt={0.8}
  resetsAt="2026-11-01T00:00:00Z"
  now={new Date()}
/>`
	},
	{
		id: 'invoice-list',
		name: 'InvoiceList',
		group,
		summary:
			'Billing history as a table that becomes cards on a phone, with status badges, download actions, totals and a pagination hook.',
		a11y: 'Keeps table, row and cell roles in the stacked layout so a screen reader still gets a table. Status badges include the word. Each download has its own label ("Download invoice INV-1004"). Paging is announced.',
		code: `import { InvoiceList } from '$lib/modules';

<InvoiceList
  {invoices}
  pageSize={5}
  on:download={(e) => save(e.detail.invoice)}
  on:pagechange={(e) => load(e.detail.page)}
/>`
	},
	{
		id: 'payment-method-card',
		name: 'PaymentMethodCard',
		group,
		summary:
			'A saved card: brand, masked last four, expiry with expired and expiring-soon states, set as default and remove.',
		a11y: 'An article named "Visa ending in 4242". Expired and expiring-soon are badges with words. Buttons name the card they act on. Remove asks in an alertdialog that focuses the safe choice.',
		code: `import { PaymentMethodCard } from '$lib/modules';

<PaymentMethodCard
  method={{ id: 'pm_1', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2027, isDefault: true }}
  now={new Date()}
  on:setDefault={makeDefault}
  on:remove={removeCard}
/>`
	},
	{
		id: 'payment-method-form',
		name: 'PaymentMethodForm',
		group,
		summary:
			'Add a card: number grouped by brand with a Luhn check, MM/YY expiry, a CVC whose length follows the brand. Demo only: plain inputs, no payment SDK.',
		a11y: 'cc-name, cc-number, cc-exp and cc-csc autocomplete; numeric keyboards. Errors show inline after blur or submit, tied with aria-describedby and aria-invalid, and are summarised in a role="alert" box that takes focus with links to each field.',
		code: `import { PaymentMethodForm } from '$lib/modules';

<!-- Demo fields. In production use your processor's hosted fields. -->
<PaymentMethodForm on:submit={(e) => console.log(e.detail.brand, e.detail.last4)} />`
	},
	{
		id: 'checkout-form',
		name: 'CheckoutForm',
		group,
		summary:
			'Contact, a country-aware address, shipping method cards and an order summary. The summary is a disclosure on a phone and a sidebar from 48rem.',
		a11y: 'Fieldsets with legends; shipping-* autocomplete; the region field is a select or text and the postal label follows the country. Submit errors are summarised in a focused role="alert" with links. The pay button keeps focus while loading; the total is a polite live region.',
		code: `import { CheckoutForm } from '$lib/modules';

<CheckoutForm
  {items}
  shippingMethods={methods}
  taxRate={0.08}
  loading={paying}
  on:submit={(e) => pay(e.detail)}
>
  <PaymentFields slot="payment" />
</CheckoutForm>`
	},
	{
		id: 'cart-summary',
		name: 'CartSummary',
		group,
		summary:
			'Line items with a quantity stepper and remove, a promo code box, and subtotal, discount, shipping, tax and total. Has an empty state.',
		a11y: 'Steppers are labelled with the item name. Changes are announced in a polite status line, and focus returns to the heading after a removal. Promo errors are tied to the input. Totals are a polite live region.',
		code: `import { CartSummary } from '$lib/modules';

<CartSummary
  bind:items
  promos={[{ code: 'SAVE10', kind: 'percent', value: 10 }]}
  taxRate={0.08}
  on:checkout={goToCheckout}
/>`
	},
	{
		id: 'order-status-tracker',
		name: 'OrderStatusTracker',
		group,
		summary:
			'The steps an order goes through with where it is now and the estimated delivery. Vertical on a phone, horizontal on wide screens.',
		a11y: 'An ordered list; the current step has aria-current="step". Each step says Completed, Current step or Upcoming in text, so state is not only a colour or an icon. Dates are <time> elements.',
		code: `import { OrderStatusTracker } from '$lib/modules';

<OrderStatusTracker
  steps={[{ id: 'placed', label: 'Order placed' }, { id: 'shipped', label: 'Shipped' }]}
  current={1}
  eta="2026-10-20"
/>`
	},
	{
		id: 'product-card',
		name: 'ProductCard',
		group,
		summary:
			'A product tile: image with alt text, price or sale price, rating, add to cart and a sold-out state.',
		a11y: 'An article with a heading of your level. The image needs real alt text. Sale and original prices are announced ("Sale price", "Original price"). Sold out is a badge and a disabled button saying so. Add is confirmed in a polite status.',
		code: `import { ProductCard } from '$lib/modules';

<ProductCard
  product={{ id: 'p1', name: 'Mug', image: '/mug.jpg', imageAlt: 'White ceramic mug', priceCents: 1800, salePriceCents: 1400, rating: 4.5, reviewCount: 32 }}
  on:add={(e) => cart.add(e.detail.id)}
/>`
	},
	{
		id: 'product-gallery',
		name: 'ProductGallery',
		group,
		summary: 'A large image with a thumbnail strip and previous and next buttons. No swipe needed.',
		a11y: 'A named group (roledescription "gallery"). Arrow keys, Home and End move between images; thumbnails are buttons marked aria-current; the caption "Image 2 of 5" is a polite live region. The strip scrolls inside itself.',
		code: `import { ProductGallery } from '$lib/modules';

<ProductGallery bind:index images={[{ src: '/a.jpg', alt: 'Front view' }, { src: '/b.jpg', alt: 'Side view' }]} />`
	},
	{
		id: 'reviews-ratings',
		name: 'ReviewsRatings',
		group,
		summary:
			'The average, a bar per star count, a sortable review list with helpful buttons, and an optional form to write a review.',
		a11y: 'Bars carry their numbers as text. The sort is a native select and the result is announced. Helpful is a toggle with aria-pressed. The write form uses a star-rating radio group and tied inline errors.',
		code: `import { ReviewsRatings } from '$lib/modules';

<ReviewsRatings {reviews} canWrite on:submit={postReview} on:helpful={markHelpful} />`
	},
	{
		id: 'rating-stars',
		name: 'RatingStars',
		group,
		summary: 'Stars to read (with half stars) or to give (a radio group).',
		a11y: 'Display: the stars are hidden and one text alternative ("4.5 out of 5 stars, 12 reviews") is read. Input: a fieldset with legend and real radios, so arrow keys and forms work; the filled state has an outline, not only a colour.',
		code: `import { RatingStars } from '$lib/modules';

<RatingStars value={4.5} count={12} showValue />
<RatingStars variant="input" label="Your rating" bind:value={mine} />`
	},
	{
		id: 'status-page',
		name: 'StatusPage',
		group,
		summary:
			'System components with status badges, 90-day uptime strips with a text alternative for every day, and an incident list.',
		a11y: 'Every day has a text label ("Jan 4, 2026: Outage, 42 minutes"). The strip is one tab stop; arrows pick a day and its text is printed beneath. A "Days with issues" disclosure lists only the bad days. Status is badge text, and bad days are striped.',
		code: `import { StatusPage } from '$lib/modules';

<StatusPage {components} {incidents} updatedAt="2026-10-13T09:00:00Z" />`
	},
	{
		id: 'changelog-list',
		name: 'ChangelogList',
		group,
		summary:
			'Releases newest first, each change tagged New, Improved, Fixed, Security, Breaking or Deprecated, with a type filter and anchor links.',
		a11y: 'Each version heading is an anchor link with an aria-label. The filter is a checkbox group (checked chips show a tick). "Showing 2 of 5 releases" is a polite status. Tags include their word.',
		code: `import { ChangelogList } from '$lib/modules';

<ChangelogList {releases} bind:types />`
	},
	{
		id: 'waitlist-signup',
		name: 'WaitlistSignup',
		group,
		summary:
			'An email box that joins a waitlist, then shows your position and a referral link to share.',
		a11y: 'The email field has autocomplete and a tied, announced error. After joining, focus moves to the confirmation heading and the position is a status. Copy link reports success in a live region.',
		code: `import { WaitlistSignup } from '$lib/modules';

<WaitlistSignup bind:state position={1204} referralCode="ada" shareUrl="https://example.com/" on:join={join} />`
	},
	{
		id: 'coupon-banner',
		name: 'CouponBanner',
		group,
		summary:
			'A promo message with a copyable code and a countdown to the end. The clock is injectable.',
		a11y: 'The timer has aria-live="off"; the digits are hidden from assistive technology and a plain "2 days, 3 hours left" is provided. With reduced motion it updates once a minute and drops seconds. Nothing animates. Copy and dismiss are 44px buttons.',
		code: `import { CouponBanner } from '$lib/modules';

<CouponBanner message="Spring sale: 20% off" code="SPRING20" endsAt="2026-11-01T00:00:00Z" />`
	}
];
