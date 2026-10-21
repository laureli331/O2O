'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function verify() {
  const [url, outDir, browserPath] = process.argv.slice(2);
  if (!url || !outDir || !browserPath || !process.env.PREVIEW_PLAYWRIGHT_PATH) {
    throw new Error('Provide URL, evidence directory, browser path and PREVIEW_PLAYWRIGHT_PATH.');
  }

  const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1120 } });
  const errors = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const shot = name => page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  const screen = value => page.locator(`[data-screen="${value}"]`).click();
  const mainPosts = () => page.locator('#main-content [data-post]');
  const profileStats = () => page.locator('.profile-stat strong').evaluateAll(items => items.map(item => item.textContent.trim()));

  try {
    await page.goto(url);
    await mainPosts().first().waitFor();

    assert.deepEqual(
      await page.locator('.tabbar [data-tab]').evaluateAll(items => items.map(item => item.dataset.tab)),
      ['首页', '发现', '发布', '服务', '我的'],
    );
    assert.equal(await page.locator('.tabbar [data-tab="消息"]').count(), 0);
    assert.equal(await page.locator('.tabbar use[href="#i-discover"]').count(), 1);
    assert.deepEqual(
      await page.locator('.discovery-section').evaluateAll(items => items.map(item => item.textContent.trim())),
      ['订阅', '发现'],
    );
    assert.equal(await page.locator('.discovery-section[aria-selected="true"]').textContent(), '发现');
    assert.deepEqual(
      await page.locator('.topic-tab').evaluateAll(items => items.map(item => item.textContent.trim())),
      ['最新', '优惠', '上新', '活动'],
    );
    assert.equal(await page.locator('.topic-tab[aria-selected="true"]').textContent(), '最新');
    assert.equal(await page.locator('#main-content .hero').count(), 0);
    assert.equal(await page.locator('#main-content .feed-tools').count(), 0);
    assert.equal(await page.locator('#main-content .verified').count(), 0);
    assert.equal(await mainPosts().count(), 3);
    for (const id of ['P-102', 'P-105', 'R-001']) {
      assert.equal(await page.locator(`#main-content [data-post="${id}"]`).count(), 0, id);
    }
    assert.deepEqual(
      await page.evaluate(() => V06Model.feed(V06Model.posts, '最新').map(post => post.id)),
      ['P-103', 'P-101', 'P-104'],
    );

    await page.locator('[data-discovery-section="订阅"]').click();
    assert.equal(await page.locator('.discovery-section[aria-selected="true"]').textContent(), '订阅');
    assert.deepEqual(await mainPosts().evaluateAll(items => items.map(item => item.dataset.post)), ['P-103']);
    await page.locator('[data-tab="发现"]').click();
    assert.equal(await page.locator('.discovery-section[aria-selected="true"]').textContent(), '发现');
    assert.equal(await page.locator('.topic-tab[aria-selected="true"]').textContent(), '最新');

    for (const topic of ['优惠', '上新', '活动']) {
      await page.locator(`[data-topic="${topic}"]`).click();
      assert.equal(await mainPosts().count(), 1, topic);
      assert.equal(await page.locator('.topic-tab[aria-selected="true"]').textContent(), topic);
      assert.equal(
        await page.locator('.topic-tab[aria-selected="true"]').evaluate(element => getComputedStyle(element).color),
        await page.locator('.tabbar .active').evaluate(element => getComputedStyle(element).color),
      );
      assert.equal(await page.locator('.feed-transition').evaluate(element => getComputedStyle(element).animationName), 'feed-in');
    }
    await page.locator('[data-topic="最新"]').click();
    await shot('v06-discovery');

    await page.locator('#main-content [data-post="P-103"]').click();
    const detailText = await page.locator('#detail-content').textContent();
    assert.deepEqual(
      await page.locator('#detail-content').evaluate(element => [...element.children].map(child => child.className)),
      ['detail-merchant-bar', 'gallery', 'detail-body'],
    );
    assert(detailText.includes('服务区域'));
    assert(detailText.includes('发布时间'));
    assert.equal(await page.locator('.detail-meta > span').count(), 2);
    assert.deepEqual(
      await page.locator('.detail-meta > span').evaluateAll(items => items.map(item => item.textContent.split('：')[0])),
      ['发布时间', '服务区域'],
    );
    assert(await page.locator('.detail-meta').evaluate(element => {
      const first = element.children[0].getBoundingClientRect();
      const second = element.children[1].getBoundingClientRect();
      return Math.abs(second.top - first.bottom - 4) < 0.5;
    }));
    assert(!detailText.includes('这里只展示商家公开资料'));
    assert(!detailText.includes('演示收藏失败并回滚'));
    assert(!detailText.includes('已审核'));
    assert.equal(await page.locator('.detail-back path').getAttribute('d'), 'm15 5-7 7 7 7');
    assert(await page.locator('.detail-back').evaluate(element => {
      const box = element.closest('button').getBoundingClientRect();
      return box.width >= 44 && box.height >= 44;
    }));
    assert(await page.locator('#detail-actions').isVisible());
    assert.equal((await page.locator('#detail-actions [data-action="share"]').textContent()).trim(), '分享');
    await page.locator('[data-action="favorite"]').click();
    assert((await page.locator('[data-action="favorite"]').textContent()).includes('已收藏'));
    await page.evaluate(() => V06PreviewTest.setFavoriteFailure(true));
    await page.locator('[data-action="favorite"]').click();
    assert((await page.locator('[data-action="favorite"]').textContent()).includes('已收藏'));
    assert((await page.locator('#toast').textContent()).includes('恢复原状态'));
    await page.evaluate(() => V06PreviewTest.setFavoriteFailure(false));
    await page.locator('[data-action="share"]').click();
    assert((await page.locator('#toast').textContent()).includes('仅包含已批准公开字段'));

    await page.locator('[data-action="merchant-profile"]').first().click();
    assert.equal(await page.locator('.profile-hero h2').textContent(), '木作小铺');
    assert.deepEqual(await profileStats(), ['1', '3', '25']);
    assert((await page.locator('.profile-intro').textContent()).includes('这是一家木工作坊'));
    assert(await page.locator('.profile-hero').evaluate(el=>{
      const name=el.querySelector('h2').getBoundingClientRect(),intro=el.querySelector('.profile-intro').getBoundingClientRect(),stats=el.querySelector('.profile-stats').getBoundingClientRect();
      return name.bottom<=intro.top&&intro.bottom<=stats.top;
    }));
    assert.equal(await page.locator('.profile-stat svg').count(),3);
    assert.deepEqual(await page.locator('.profile-stat').evaluateAll(items=>items.map(el=>el.getAttribute('aria-label'))),['帖子 1','订阅 3','收藏 25']);
    assert.equal(await page.locator('.profile-details').count(), 0);
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '已订阅');
    assert.equal(await page.locator('.profile-works-head h3').textContent(), '作品');
    assert.equal(await page.locator('.profile-waterfall [data-post]').count(), 1);
    await page.locator('[data-action="toggle-profile-details"]').click();
    const expandedProfile = await page.locator('#detail-content').textContent();
    for (const text of ['服务项目', '服务方式', '上门', '到店', '配送', '服务区域', '营业时间', '联系方式', '电话：138 0000 1030', '微信：muzuo_demo']) {
      assert(expandedProfile.includes(text), text);
    }
    assert.equal(await page.locator('[data-action="toggle-profile-details"]').getAttribute('aria-expanded'), 'true');
    await page.locator('[data-action="toggle-profile-filter"]').click();
    assert(await page.locator('.profile-filter-menu').isVisible());
    assert.deepEqual(
      await page.locator('[data-profile-topic]').evaluateAll(items => items.map(item => item.textContent.trim())),
      ['最新', '优惠', '上新', '活动'],
    );
    await page.locator('[data-profile-topic="活动"]').click();
    assert.equal((await page.locator('.profile-filter-trigger').textContent()).trim(), '活动');
    assert(await page.locator('.profile-filter-trigger').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.borderTopWidth==='0px'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&r.width>=44&&r.height>=44;}));
    assert.equal(await page.locator('.profile-filter-chevron').count(),1);
    assert((await page.locator('.profile-feed').textContent()).includes('活动中暂时没有内容'));
    await page.locator('[data-action="toggle-profile-filter"]').click();
    await page.locator('[data-profile-topic="最新"]').click();
    assert.equal(await page.locator('.profile-waterfall [data-post]').count(), 1);

    await page.locator('.profile-subscribe').click();
    assert(await page.locator('#subscription-dialog').isVisible());
    assert.equal(await page.locator('#subscription-dialog-title').textContent(), '不再继续订阅？');
    assert.equal(await page.locator('#subscription-dialog :focus').getAttribute('data-action'), 'keep-subscription');
    await page.keyboard.press('Escape');
    assert(await page.locator('#subscription-dialog').isHidden());
    assert.equal(await page.locator('#detail-content :focus').getAttribute('data-action'), 'toggle-subscription');
    await page.locator('.profile-subscribe').click();
    await page.locator('[data-action="keep-subscription"]').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '已订阅');

    await page.evaluate(() => V06PreviewTest.setSubscriptionFailure(false, true));
    await page.locator('.profile-subscribe').click();
    await page.locator('[data-action="confirm-unsubscribe"]').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '已订阅');
    assert.deepEqual(await profileStats(), ['1', '3', '25']);
    assert((await page.locator('#toast').textContent()).includes('取消失败'));

    await page.evaluate(() => V06PreviewTest.setSubscriptionFailure(false, false));
    await page.locator('.profile-subscribe').click();
    await page.locator('[data-action="confirm-unsubscribe"]').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '订阅');
    assert.deepEqual(await profileStats(), ['1', '2', '25']);
    assert((await page.locator('#toast').textContent()).includes('已取消订阅'));
    await page.locator('[data-action="back-detail"]').click();
    assert((await page.locator('[data-action="favorite"]').textContent()).includes('已收藏'));
    await page.locator('[data-action="merchant-profile"]').first().click();

    await page.evaluate(() => V06PreviewTest.setSubscriptionFailure(true, false));
    await page.locator('.profile-subscribe').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '订阅');
    assert.deepEqual(await profileStats(), ['1', '2', '25']);
    assert((await page.locator('#toast').textContent()).includes('订阅失败'));
    await page.evaluate(() => V06PreviewTest.setSubscriptionFailure(false, false));
    await page.locator('.profile-subscribe').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '已订阅');
    assert.deepEqual(await profileStats(), ['1', '3', '25']);
    await shot('v06-profile');

    await page.locator('[data-tab="发现"]').click();
    await page.locator('#main-content [data-post="P-104"]').click();
    await page.locator('[data-action="merchant-profile"]').first().click();
    await page.locator('[data-action="toggle-profile-details"]').click();
    const privateProfile = await page.locator('#detail-content').textContent();
    assert(!privateProfile.includes('138 0000 1040'));
    assert(!privateProfile.includes('leaf_demo'));
    assert(!privateProfile.includes('联系方式'));

    await screen('guest');
    await page.locator('[data-discovery-section="发现"]').click();
    await page.locator('#main-content [data-post="P-104"]').click();
    await page.locator('[data-action="merchant-profile"]').first().click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '订阅');
    await page.locator('.profile-subscribe').click();
    assert((await page.locator('#main-content').textContent()).includes('登录后查看订阅内容'));
    await page.locator('[data-action="login-subscriptions"]').click();
    assert.equal((await page.locator('.profile-subscribe').textContent()).trim(), '已订阅');
    assert.deepEqual(await mainPosts().evaluateAll(items => items.map(item => item.dataset.post)), ['P-103', 'P-104']);
    await page.goto(url);
    await mainPosts().first().waitFor();

    await page.locator('[data-tab="发布"]').click();
    assert((await page.locator('#main-content').textContent()).includes('基础主帖免费'));
    assert(await page.locator('#main-actions').isVisible());
    assert.equal(await page.locator('input[name="post-topic"]').count(), 4);
    await page.locator('label.topic-option').filter({ has: page.locator('input[value="上新"]') }).click();
    assert.equal(await page.locator('input[name="post-topic"]:checked').count(), 1);
    await page.locator('#post-title').fill('邻里秋日面包');
    await page.locator('#post-body').fill('今天刚出炉，是否有货以店内实际情况为准。');
    const original = await page.locator('#photo-row .photo-tile').first().textContent();
    await page.locator('[data-move="1"]').click();
    assert.notEqual(await page.locator('#photo-row .photo-tile').first().textContent(), original);
    assert.equal(await page.locator('#post-title').inputValue(), '邻里秋日面包');
    await page.locator('#post-title').fill('');
    await page.locator('#main-actions [data-action="preview-post"]').click();
    assert((await page.locator('#main-code').textContent()).includes('发布编辑'));
    assert((await page.locator('.field-error').textContent()).includes('标题'));
    await page.locator('#post-title').fill('邻里秋日面包');
    assert.equal(await page.locator('.field-error').count(), 0);
    await page.locator('#main-actions [data-action="preview-post"]').click();
    assert((await page.locator('#main-code').textContent()).includes('预览确认'));
    assert((await page.locator('#main-content').textContent()).includes('主题：上新'));
    await page.locator('[data-action="submit-review"]').click();
    assert((await page.locator('#main-content').textContent()).includes('当前已发布内容继续展示'));
    await shot('v06-pending');

    await screen('rejected');
    assert((await page.locator('#main-content').textContent()).includes('当前已发布内容继续展示'));
    await screen('approved');
    assert((await page.locator('#main-content').textContent()).includes('内容已更新'));
    await screen('risk-removed');
    assert((await page.locator('#main-content').textContent()).includes('内容暂不可见'));
    await page.locator('#role-select').selectOption('merchant-pending');
    await screen('edit');
    assert((await page.locator('#main-content').textContent()).includes('只能查看状态'));
    await page.locator('#role-select').selectOption('resident');
    assert((await page.locator('#main-content').textContent()).includes('普通居民没有商家主帖入口'));
    await page.locator('#role-select').selectOption('merchant-approved');

    await screen('empty');
    assert.equal(await mainPosts().count(), 0);
    assert(!(await page.locator('#main-content').textContent()).includes('不会用假帖子'));
    await page.locator('[data-action="view-latest"]').click();
    assert.equal(await mainPosts().count(), 3);
    await screen('guest');
    assert.equal(await mainPosts().count(), 0);
    assert((await page.locator('#main-content').textContent()).includes('登录后查看订阅内容'));
    assert(await page.locator('[data-action="login-subscriptions"]').isVisible());
    await page.locator('[data-discovery-section="发现"]').click();
    assert.equal(await mainPosts().count(), 3);
    await page.locator('[data-discovery-section="订阅"]').click();
    await page.locator('[data-action="login-subscriptions"]').click();
    assert.deepEqual(await mainPosts().evaluateAll(items => items.map(item => item.dataset.post)), ['P-103']);
    await screen('failed');
    assert.equal(await page.locator('.discovery-section[aria-selected="true"]').textContent(), '订阅');
    assert.deepEqual(await mainPosts().evaluateAll(items => items.map(item => item.dataset.post)), ['P-103']);
    assert((await page.locator('#main-content').textContent()).includes('加载失败，已保留上次内容'));
    await page.locator('[data-action="retry-feed"]').click();
    await page.locator('[data-tab="发现"]').click();
    assert.equal(await page.locator('.discovery-section[aria-selected="true"]').textContent(), '发现');
    assert.equal(await page.locator('.topic-tab[aria-selected="true"]').textContent(), '最新');

    await screen('failed');
    assert.equal(await mainPosts().count(), 3);
    assert((await page.locator('#main-content').textContent()).includes('加载失败，已保留上次内容'));
    await page.locator('[data-action="retry-feed"]').click();
    await screen('notices');
    assert.equal(await page.locator('#main-head h2').textContent(), '通知中心');
    await shot('v06-notices');

    for (const width of [414, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await mainPosts().first().waitFor();
      assert(await page.locator('.discovery-section[aria-selected="true"]').evaluate(el=>['none','normal',''].includes(getComputedStyle(el,'::after').content)&&getComputedStyle(el).textDecorationLine==='none'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), String(width));
      await page.locator('#main-content [data-post="P-103"]').click();
      await page.locator('[data-action="merchant-profile"]').first().click();
      await page.locator('[data-action="toggle-profile-details"]').click();
      await page.locator('[data-action="toggle-profile-filter"]').click();
      assert(await page.locator('.profile-stats').evaluate(el=>{
        const cells=[...el.children],intro=el.previousElementSibling.getBoundingClientRect(),row=el.getBoundingClientRect();
        return intro.bottom<=row.top&&cells.every(cell=>{const icon=cell.querySelector('svg').getBoundingClientRect(),number=cell.querySelector('strong').getBoundingClientRect();return icon.right<=number.left&&Math.abs(icon.y+icon.height/2-number.y-number.height/2)<2;})&&Math.max(...cells.map(x=>x.getBoundingClientRect().y))-Math.min(...cells.map(x=>x.getBoundingClientRect().y))<2;
      }),`inline-profile-stats-${width}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `profile-${width}`);
      await page.locator('.profile-subscribe').click();
      assert(await page.locator('#subscription-dialog').isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `dialog-${width}`);
      await page.keyboard.press('Escape');
      await shot(`v06-${width}`);
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    assert(await page.evaluate(() => getComputedStyle(document.querySelector('.post-card')).transitionDuration === '0s'));
    assert.equal(await page.locator('.feed-transition').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.deepEqual(errors, []);

    const checks = [
      'approved displayable merchant feed',
      'subscription/discovery navigation',
      'guest subscription login state',
      'topic filtering and reset',
      'detail gallery and fixed actions',
      'favorite rollback and public-field share',
      'merchant profile stats and details',
      'authorized contact visibility',
      'single-select merchant works filter',
      'subscription success and failure rollback',
      'unsubscribe confirmation and favorite retention',
      'merchant eligibility and review continuity',
      'service notification entry',
      'load failure retention',
      '320/375/414 overflow',
      'reduced motion',
      'browser error log',
    ];
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ passed: true, checks }, null, 2));
    console.log(JSON.stringify({
      passed: true,
      checks: checks.length,
      screenshots: fs.readdirSync(outDir).filter(name => name.endsWith('.png')),
    }));
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
