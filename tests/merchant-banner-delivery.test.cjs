'use strict';
// Validate the approved planning contract; no advertising, payment or real timer is started.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),recordPath='docs/merchant-pricing-confirmed-20261016.json';
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'});
const expectedCarousel={mode:'automatic-with-manual-controls',manualSwipe:true,pauseResumeControl:true,restartIntervalAfterManualSwipe:true,pauseWhenPageNotVisible:true,visibleReturnKeepsCurrentSlide:true,visibleReturnRestartsInterval:true,singleSlideAutoRotation:false};
const expectedActivation={requiresQualificationApproved:true,requiresMaterialApproved:true,requiresScheduleConfirmed:true,requiresPaymentSucceeded:true,requiresActuallyDisplayable:true,start:'confirmed-actual-advertising-start-after-payment-and-display-availability',periodDays:30,paymentAloneStartsClock:false,reviewAloneStartsClock:false};
const expectedPending={"scheduleConflictRule":null,"refundRule":null,"paymentChannel":null,"initialDefaultTrigger":null,"materialSpecification":null,"materialCountPerAdvertiser":null,"deliveryMetricDefinitions":null,"expiryAndRenewalRule":null,"faultCompensation":null,"manualPauseVisibilityPriority":null,"placeholderContentSpecification":null,"advertisingCooperationPageDetails":null,"advertisingDetailFieldSpecifications":null,"advertisingContactAuthorizationInteraction":null,"advertisingDetailReviewAndUpdateRule":null};
const expectedResponses=[
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",0]',id:'banner-position-capacity',selected:'A',question:'接下来讨论首页Banner的商业交付。保留首图／次图／末图299／249／199元每30天的候选报价，起步同时售卖多少名额？本题不启用正式售卖。',answer:'A（推荐）：同一投放期间共3个位置，每个位置只对应1个广告主；首图默认展示。容易说明交付，也容易核对。'},
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",1]',id:'banner-carousel-behavior',selected:'A',question:'首页Banner采用哪种轮播方式？这是拟议的展示规则，不代表保证每次访问都能看到全部广告。',answer:'A（推荐）：每5秒自动切换，可手动滑动及暂停／继续；手动切换后重新计时，页面不可见时暂停，恢复可见保留当前图重新计时，只有1张时不自动切换。'},
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",2]',id:'banner-review-payment-activation-order',selected:'A',question:'Banner采用哪种审核、付款和投放起算顺序？本题只决定顺序，名额保留、广告退款与实际支付通道另行确认。',answer:'A（推荐）：先审核广告资格和素材、确认排期，再付款；付款成功且广告实际可展示后，才从确认的实际投放开始时刻计算连续30天。'}
];
const expectedReservationResponses=[{"questionItemId":"[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",0]","id":"banner-payment-reservation","selected":"A","question":"广告资格、素材和排期已确认后，为待付款商家保留位置多久？建议从待付款订单成功建立且该位置实际保留时起算；到期须核实未付款才释放，支付处理中或结果未知时先核实，不能直接再次售卖。","answer":"A（推荐）：保留连续24小时，兼顾商家付款时间和位置周转。"},{"questionItemId":"[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",1]","id":"banner-empty-position-display","selected":"B","question":"首页Banner有位置未售出时怎样展示？下列方案都不改变已购位置的价格、合同期限和原有顺序。","answer":"B：空位使用平台招商或公益占位图，保留固定3张展示结构；占位内容和点击目标另行确认。"},{"questionItemId":"[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",2]","id":"banner-main-image-and-destination","selected":"A","question":"每个Banner位置的主图和点击去向如何安排？广告详情的具体字段及联系方式展示规则仍另行确认。","answer":"A（推荐）：每位置只展示1张已审核主图，首页最多3张广告图；点击进入本小程序内独立广告详情页，承载更多宣传内容。"}];
const expectedPlaceholderResponse={"questionItemId":"[\"request_user_input_async\",\"call_98364233402946afbc4f5e09ea5d77c4\",0]","id":"banner-placeholder-content-and-destination","selected":"A","question":"下一步确认占位图：首页未售出的Banner位置，默认展示什么、点击去哪里？以下均保留固定3张结构，不调整已购位置的顺序。","answer":"A（推荐）：默认展示“本地商家广告合作”招商图，点击进入本小程序的广告合作说明页；运营可替换为经审核的公益图，公益图暂不提供点击跳转。"};
const expectedPlaceholder={"defaultKind":"merchant-advertising-cooperation","defaultLabel":"本地商家广告合作","defaultClickTarget":"in-mini-program-advertising-cooperation-information","publicInterestReplacement":{"operatorMayReplace":true,"reviewRequired":true,"clickEnabled":false}};
const expectedDetailResponses=[{"questionItemId":"[\"request_user_input_async\",\"call_184232447b9c46b3bf637b93d67cd1ff\",0]","id":"banner-advertising-detail-field-scope","selected":"A","question":"上一组第2题：付费Banner点击后的独立广告详情页，起步提供哪些宣传内容？这里只确认字段范围，字数、图片数量和尺寸后续细化。","answer":"A（推荐）：必填经营名称、广告标题、宣传说明、经营／服务区域；可选营业时间、门店详细地址及补充图片。首页已审核主图同时展示在详情页。"},{"questionItemId":"[\"request_user_input_async\",\"call_184232447b9c46b3bf637b93d67cd1ff\",1]","id":"banner-authorized-public-business-contact","selected":"A","question":"上一组第3题：广告详情页是否直接展示商家联系方式？仅限商家另行授权公开的经营联系方式，不改变居民交易联系方式打码规则，也不使用私下提交的实名核验资料。","answer":"A（推荐）：商家可另行填写并明确授权公开经营联系电话，访客无需登录即可查看和点击拨号；门店详细地址仅在上一题选择提供该字段且商家授权公开时展示。"}];
const expectedAdvertisingDetail={"requiredFields":["business-name","advertising-title","promotional-description","business-or-service-area"],"optionalFields":["business-hours","detailed-store-address","supplementary-images","business-phone"],"showApprovedHomeMainImage":true,"businessPhone":{"separatelyProvidedByAdvertiser":true,"requiresSeparatePublicAuthorization":true,"viewRequiresLogin":false,"clickToCall":true},"detailedStoreAddress":{"requiresPublicAuthorization":true},"residentContactMaskingChanged":false,"privateVerificationDataMayBeReused":false};
function validate(r){
 const b=r.banner,d=r.bannerDeliveryDecision;
 assert.deepEqual(b.advertisingDetail,expectedAdvertisingDetail,'Approved field scope and authorized business contacts');
 assert.deepEqual(r.bannerDetailAndContactDecision.responses,expectedDetailResponses,'Actual reissued questions and separate A replies');
 assert.equal(r.bannerDetailAndContactDecision.realSalesAuthorized,false);
 assert.deepEqual(b.placeholder,expectedPlaceholder,'Approved placeholder content and destinations');
 assert.deepEqual(r.bannerPlaceholderDecision.responses,[expectedPlaceholderResponse],'Only the received first answer is recorded');
 assert.equal(r.bannerPlaceholderDecision.realSalesAuthorized,false);
 assert.deepEqual(r.bannerReservationAndDisplayDecision.responses,expectedReservationResponses,'Exact second Banner questions and replies');
 assert.equal(r.bannerReservationAndDisplayDecision.realSalesAuthorized,false);
 assert.equal(d.date,'2026-10-17');assert.equal(d.responseType,'structured-question-replies');
 assert.deepEqual(d.responses,expectedResponses,'Exact questions and replies');
 assert.equal(Object.hasOwn(d,'userReply'),false,'No invented aggregate reply');
 assert.equal(d.scope,'v2-home-carousel-capacity-behavior-and-purchase-order');
 assert.equal(d.realSalesAuthorized,false);
 assert.equal(b.surface,'home-carousel');assert.equal(b.independentSimultaneousAreas,false);
 assert.equal(b.positionCount,3,'Exactly three positions');assert.equal(b.maxAdvertisersPerTier,1,'One advertiser per position');
 assert.equal(b.defaultSlide,'first');assert.equal(b.rotationSeconds,5,'Five-second rotation');
 assert.deepEqual(b.candidateMonthlyPricesCents,[29900,24900,19900]);
 assert.deepEqual(b.carousel,expectedCarousel,'Approved carousel behavior');
 assert.deepEqual(b.purchaseSequence,['qualification-and-material-review','schedule-confirmation','payment','actual-display-availability'],'Approved review and payment order');
 assert.deepEqual(b.activation,expectedActivation,'Approved advertising start');
 assert.deepEqual(b.pendingDetails,expectedPending,'Unconfirmed delivery rules remain unfilled');
 assert.deepEqual(b.reservation,{"unit":"continuous-hours","hours":24,"start":"pending-payment-order-successfully-created-and-position-actually-held","requiresQualificationAndMaterialApproved":true,"requiresScheduleConfirmed":true,"expiryReleaseRequiresVerifiedUnpaid":true,"processingOrUnknownPayment":"verify-first-do-not-release-or-resell"},'Approved 24-hour reservation');
 assert.deepEqual(b.emptyPositionDisplay,{"mode":"platform-recruitment-or-public-interest-placeholder","fixedSlideCount":3,"hideUnusedPositions":false,"paidPositionPriceChanged":false,"paidPeriodChanged":false,"paidPositionOrderChanged":false},'Approved fixed placeholders');
 assert.deepEqual(b.mainImage,{"imagesPerPosition":1,"reviewRequired":true,"maxPaidMainImages":3,"clickTarget":"in-mini-program-independent-advertising-detail"},'Approved main image and destination');
 assert.equal(b.deliveryRulesComplete,false);assert.equal(b.release,'v2');assert.equal(b.requiresMembership,false);
 assert.equal(b.monthDefinition,'30-continuous-days');
 assert.equal(r.prepaidServices.reviewPaymentOrder,null,'Banner approval does not decide content-heating purchase order');
 for(const [key,value] of Object.entries(r.execution))assert.equal(value,false,key+' remains gated');
 return true;
}
test('three A replies confirm scoped Banner delivery rules without enabling sales',()=>assert.equal(validate(load()),true));

for(const [name,mutate] of [
 ['four positions substituted',r=>r.banner.positionCount=4],
 ['two advertisers share a position',r=>r.banner.maxAdvertisersPerTier=2],
 ['three separate areas substituted',r=>r.banner.independentSimultaneousAreas=true],
 ['rotation interval becomes eight seconds',r=>r.banner.rotationSeconds=8],
 ['manual swipe removed',r=>r.banner.carousel.manualSwipe=false],
 ['pause control removed',r=>r.banner.carousel.pauseResumeControl=false],
 ['manual swipe keeps old countdown',r=>r.banner.carousel.restartIntervalAfterManualSwipe=false],
 ['invisible page keeps switching',r=>r.banner.carousel.pauseWhenPageNotVisible=false],
 ['visibility return resets to first image',r=>r.banner.carousel.visibleReturnKeepsCurrentSlide=false],
 ['visibility return reuses partial countdown',r=>r.banner.carousel.visibleReturnRestartsInterval=false],
 ['single image auto switches',r=>r.banner.carousel.singleSlideAutoRotation=true],
 ['payment precedes review',r=>r.banner.purchaseSequence.reverse()],
 ['payment alone starts clock',r=>r.banner.activation.paymentAloneStartsClock=true],
 ['review alone starts clock',r=>r.banner.activation.reviewAloneStartsClock=true],
 ['display availability not required',r=>r.banner.activation.requiresActuallyDisplayable=false],
 ['schedule confirmation not required',r=>r.banner.activation.requiresScheduleConfirmed=false],
 ['material review not required',r=>r.banner.activation.requiresMaterialApproved=false],
 ['service length becomes calendar month',r=>r.banner.activation.periodDays='calendar-month'],
 ['legacy 15-minute hold revived',r=>r.banner.reservation.hours=0.25],
 ['membership refund copied to ads',r=>r.banner.pendingDetails.refundRule='membership-refund'],
 ['advertising channel invented',r=>r.banner.pendingDetails.paymentChannel='wechat'],
 ['empty positions hidden without approval',r=>r.banner.emptyPositionDisplay.hideUnusedPositions=true],
 ['manual pause priority silently assumed',r=>r.banner.pendingDetails.manualPauseVisibilityPriority='always-restart'],
 ['all delivery details treated as complete',r=>r.banner.deliveryRulesComplete=true],
 ['formal prices silently activated',r=>r.execution.formalSalePricesApproved=true],
 ['real sales authorized',r=>r.bannerDeliveryDecision.realSalesAuthorized=true],
 ['technical detailing resumed',r=>r.execution.technicalDetailingResumed=true]
])test('Banner contract rejects '+name,()=>{const r=load();mutate(r);assert.throws(()=>validate(r));});

test('new delivery approval preserves every earlier price, reply, membership and billing decision',()=>{
 const live=load(),r=JSON.parse(at(live.bannerReservationAndDisplayDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.bannerDeliveryDecision.sourceCommit,recordPath));
 const current=structuredClone(r);delete current.bannerDeliveryDecision;
 current.banner.rotationSeconds=null;current.banner.maxAdvertisersPerTier=null;
 for(const key of ['positionCount','carousel','purchaseSequence','activation','pendingDetails'])delete current.banner[key];
 assert.deepEqual(current,prior);
 for(const p of ['docs/merchant-membership-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.md'])assert.equal(read(p).replace(/\r\n/g,'\n'),at(r.bannerDeliveryDecision.sourceCommit,p).replace(/\r\n/g,'\n'),'Membership contract unchanged: '+p);
});

test('all current document entries state the approved capacity, behavior and start order',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file),first=s.split(/\r?\n/).find(line=>line.startsWith('Banner交付三项确认（2026-10-17）'));
  for(const phrase of ['Banner交付三项确认（2026-10-17）','同一投放期间共3个位置，各对应1个广告主','每5秒自动切换','手动滑动及暂停/继续','页面不可见时暂停','恢复可见保留当前图重新计时','只有1张时不自动切换','先审核广告资格和素材、确认排期，再付款','付款成功且广告实际可展示后','299/249/199元仍为候选报价','不继承会员退款政策','第二版'])assert(first.includes(phrase),file+': '+phrase);
  for(const m of s.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('#')[0])),file+': '+m[1]);}
 }
});

test('F08 field definitions agree while the existing page mapping and task scope stay intact',()=>{
 const r=load(),prd=read('docs/prd.md'),design=read('docs/structured-design.md');
 const row=s=>s.match(/^\| F08 \| 商家Banner方向 \|[^\r\n]+/m)[0];assert.equal(row(prd),row(design));
 for(const phrase of ['首/次/末3个位置，各1广告主','每5秒自动切换','先审核资格/素材和确认排期再付款','三位置来自本次明确选择','不恢复旧维修/跑腿各三位','不开放真实售卖'])assert(row(prd).includes(phrase),phrase);
 const mapping=s=>s.match(/^\| F08 \| V01[^\r\n]+/m)[0];assert.equal(mapping(design),mapping(at(r.bannerDeliveryDecision.sourceCommit,'docs/structured-design.md')));
 assert.equal([...read('docs/development-plan.md').matchAll(/^\| DP\d{2} \|/gm)].length,57);
 assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')).deferredTaskIds,['DP30','DP31','DP32','DP33','DP34','DP35']);
});

test('delivery documentation distinguishes a rotation opportunity from actual impressions',()=>{
 const s=read('docs/merchant-pricing-confirmed-20261016.md');
 for(const phrase of ['### 3.1','不是三个独立同时可见的广告区','不将一轮轮播当作已核实展示量','不将点击、联系操作当实际咨询/到店/成交','不保证售满','审核通过或付款成功单独都不能开始投放时钟','24小时付款保留','用户手动暂停后隐藏/恢复等优先关系待后续细化','同一广告主可购位置与素材总量仍待确认'])assert(s.includes(phrase),phrase);
 assert.equal(30*24*60*60,2592000,'Purchased period is thirty continuous days, not total accumulated on-screen seconds');
});

test('second Banner batch preserves exact A B A questions and answers',()=>{
 const d=load().bannerReservationAndDisplayDecision;assert.equal(d.date,'2026-10-17');assert.equal(d.responseType,'structured-question-replies');
 assert.deepEqual(d.responses,[
 {
  "questionItemId": "[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",0]",
  "id": "banner-payment-reservation",
  "selected": "A",
  "question": "广告资格、素材和排期已确认后，为待付款商家保留位置多久？建议从待付款订单成功建立且该位置实际保留时起算；到期须核实未付款才释放，支付处理中或结果未知时先核实，不能直接再次售卖。",
  "answer": "A（推荐）：保留连续24小时，兼顾商家付款时间和位置周转。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",1]",
  "id": "banner-empty-position-display",
  "selected": "B",
  "question": "首页Banner有位置未售出时怎样展示？下列方案都不改变已购位置的价格、合同期限和原有顺序。",
  "answer": "B：空位使用平台招商或公益占位图，保留固定3张展示结构；占位内容和点击目标另行确认。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_6e379f52cfda42529d30bc2377cdcc5e\",2]",
  "id": "banner-main-image-and-destination",
  "selected": "A",
  "question": "每个Banner位置的主图和点击去向如何安排？广告详情的具体字段及联系方式展示规则仍另行确认。",
  "answer": "A（推荐）：每位置只展示1张已审核主图，首页最多3张广告图；点击进入本小程序内独立广告详情页，承载更多宣传内容。"
 }
]);
 assert.deepEqual(d.responses.map(x=>x.selected),['A','B','A']);assert.equal(Object.hasOwn(d,'userReply'),false);assert.equal(d.realSalesAuthorized,false);
});
test('A B A approval changes only reservation display main-image and their pending fields',()=>{
 const live=load(),r=JSON.parse(at(live.bannerPlaceholderDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.bannerReservationAndDisplayDecision.sourceCommit,recordPath));const current=structuredClone(r);delete current.bannerReservationAndDisplayDecision;
 for(const k of ['reservation','emptyPositionDisplay','mainImage'])delete current.banner[k];current.banner.pendingDetails=structuredClone(prior.banner.pendingDetails);assert.deepEqual(current,prior);
});
test('current document entries explicitly state B placeholders rather than the unselected hide policy',()=>{
 for(const file of ["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"]){
  const first=read(file).split(/\r?\n/).find(line=>line.startsWith('Banner保留及展示确认'));for(const phrase of ['Banner保留及展示确认（2026-10-17）','用户本组逐题选择A、B、A','订单成功建立且位置实际保留','保留连续24小时','支付处理中或未知先核实','平台招商或公益占位图','固定3张展示结构','每位置只展示1张已审核主图','本小程序内独立广告详情页','占位素材/合作说明页内容、详情字数/配图规格及授权交互等仍待确认','24小时保留不等于30天投放起算'])assert(first.includes(phrase),file+': '+phrase);
 }
});
test('fixed placeholders keep three total slides with zero one two or three paid advertisers',()=>{
 const b=load().banner;for(const paid of [0,1,2,3]){const placeholders=b.emptyPositionDisplay.fixedSlideCount-paid;const total=paid*b.mainImage.imagesPerPosition+placeholders;assert.equal(total,3);assert.notEqual(total,1);assert.equal(b.rotationSeconds,5);}
 assert.equal(b.carousel.singleSlideAutoRotation,false);const s=read('docs/merchant-pricing-confirmed-20261016.md');for(const phrase of ['付费广告只有0或1个','不隐藏空位','首位空缺不会把次位前移成首位','异常缺图时的降级处理尚未确认'])assert(s.includes(phrase),phrase);
});
test('reservation and advertising periods remain separate and unknown payments prevent release',()=>{
 const b=load().banner;assert.equal(b.reservation.hours*3600,86400);assert.equal(b.activation.periodDays*86400,2592000);assert.equal(b.reservation.expiryReleaseRequiresVerifiedUnpaid,true);assert.equal(b.reservation.processingOrUnknownPayment,'verify-first-do-not-release-or-resell');assert.equal(b.activation.paymentAloneStartsClock,false);
 const s=read('docs/merchant-pricing-confirmed-20261016.md');for(const phrase of ['订单建立失败或实际未保留不能启动此保留期','到期仍须核实未付款才释放','迟到付款、核验/释放并发、排期冲突仍待单独细化','详情字段及经营联系方式公开原则按第3.4节确认'])assert(s.includes(phrase),phrase);
});
test('reservation/display rejects hold extended to 48 hours',()=>{const r=load();r.banner.reservation.hours=48;assert.throws(()=>validate(r));});
test('reservation/display rejects hold uses working hours',()=>{const r=load();r.banner.reservation.unit='working-hours';assert.throws(()=>validate(r));});
test('reservation/display rejects hold starts before actual reservation',()=>{const r=load();r.banner.reservation.start='review-approved';assert.throws(()=>validate(r));});
test('reservation/display rejects expired hold releases without payment check',()=>{const r=load();r.banner.reservation.expiryReleaseRequiresVerifiedUnpaid=false;assert.throws(()=>validate(r));});
test('reservation/display rejects unknown payment slot resold',()=>{const r=load();r.banner.reservation.processingOrUnknownPayment='release-and-resell';assert.throws(()=>validate(r));});
test('reservation/display rejects B answer silently recorded as A',()=>{const r=load();r.bannerReservationAndDisplayDecision.responses[1].selected='A';assert.throws(()=>validate(r));});
test('reservation/display rejects fixed structure reduced to paid count',()=>{const r=load();r.banner.emptyPositionDisplay.fixedSlideCount=1;assert.throws(()=>validate(r));});
test('reservation/display rejects placeholder changes paid order',()=>{const r=load();r.banner.emptyPositionDisplay.paidPositionOrderChanged=true;assert.throws(()=>validate(r));});
test('reservation/display rejects placeholder changes paid price',()=>{const r=load();r.banner.emptyPositionDisplay.paidPositionPriceChanged=true;assert.throws(()=>validate(r));});
test('reservation/display rejects multiple main images per position',()=>{const r=load();r.banner.mainImage.imagesPerPosition=2;assert.throws(()=>validate(r));});
test('reservation/display rejects unreviewed main image allowed',()=>{const r=load();r.banner.mainImage.reviewRequired=false;assert.throws(()=>validate(r));});
test('reservation/display rejects paid main image goes outside mini-program',()=>{const r=load();r.banner.mainImage.clickTarget='external-url';assert.throws(()=>validate(r));});
test('reservation/display rejects placeholder phone target invented',()=>{const r=load();r.banner.pendingDetails.placeholderClickTarget='phone-call';assert.throws(()=>validate(r));});
test('ad detail rejects public phone without separate authorization',()=>{const r=load();r.banner.advertisingDetail.businessPhone.requiresSeparatePublicAuthorization=false;assert.throws(()=>validate(r));});

test('placeholder reply records only the actual first A with complete provenance',()=>{
 const d=load().bannerPlaceholderDecision;assert.equal(d.date,'2026-10-17');assert.equal(d.sourceCommit,'32713225699de04bba6a5bfc35b645f9dfe953d9');assert.equal(d.responseType,'structured-question-replies');assert.equal(d.scope,'banner-placeholder-content-and-destination-only');assert.equal(Object.hasOwn(d,'userReply'),false);assert.deepEqual(d.responses,[expectedPlaceholderResponse]);
});
test('placeholder choice preserves all earlier prices membership billing and delivery approvals',()=>{
 const live=load(),r=JSON.parse(at(live.bannerDetailAndContactDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.bannerPlaceholderDecision.sourceCommit,recordPath));delete r.bannerPlaceholderDecision;delete r.banner.placeholder;r.banner.pendingDetails=structuredClone(prior.banner.pendingDetails);assert.deepEqual(r,prior);
});
test('historical unanswered advertising fields were pending until actual later replies',()=>{
 const live=load(),b=JSON.parse(at(live.bannerDetailAndContactDecision.sourceCommit,recordPath)).banner;assert.equal(b.pendingDetails.advertisingDetailFields,null);assert.equal(b.pendingDetails.advertisingDetailContactDisclosure,null);assert.equal(b.pendingDetails.placeholderContentSpecification,null);assert.equal(b.pendingDetails.advertisingCooperationPageDetails,null);assert.equal(Object.hasOwn(b.pendingDetails,'placeholderClickTarget'),false);assert.notEqual(b.placeholder.defaultClickTarget,b.mainImage.clickTarget);
});
test('all document entries distinguish招商 internal cooperation and reviewed公益 no-click',()=>{
 for(const file of ["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"]){
  const first=read(file).split(/\r?\n/).find(line=>line.startsWith('Banner占位图确认'));for(const phrase of ['Banner占位图确认（2026-10-17）','此前单独确认第一题A','默认展示“本地商家广告合作”招商图','本小程序的广告合作说明页','经审核的公益图','公益图暂不提供点击跳转','保留固定3张及已购位置顺序','详情字段与经营联系方式已另行逐题确认A','合作说明页具体内容仍待细化'])assert(first.includes(phrase),file+': '+phrase);
 }
});
test('detailed placeholder section preserves exact original question and answer',()=>{const s=read('docs/merchant-pricing-confirmed-20261016.md');assert(s.includes(expectedPlaceholderResponse.question));assert(s.includes(expectedPlaceholderResponse.answer));assert(s.includes('### 3.3'));assert(!s.includes('占位内容和占位点击去向均未批准'));});
test('placeholder choice rejects recruitment destination replaced with external page',()=>{const r=load();r.banner.placeholder.defaultClickTarget='external-url';assert.throws(()=>validate(r));});
test('placeholder choice rejects public-interest click silently enabled',()=>{const r=load();r.banner.placeholder.publicInterestReplacement.clickEnabled=true;assert.throws(()=>validate(r));});
test('placeholder choice rejects public-interest review removed',()=>{const r=load();r.banner.placeholder.publicInterestReplacement.reviewRequired=false;assert.throws(()=>validate(r));});
test('placeholder choice rejects unreceived second answer invented',()=>{const r=load();r.bannerPlaceholderDecision.responses.push({...r.bannerPlaceholderDecision.responses[0],id:'advertising-detail-fields'});assert.throws(()=>validate(r));});
test('ad detail rejects missing required service area',()=>{const r=load();r.banner.advertisingDetail.requiredFields.pop();assert.throws(()=>validate(r));});
test('ad detail rejects reuse of private verification data',()=>{const r=load();r.banner.advertisingDetail.privateVerificationDataMayBeReused=true;assert.throws(()=>validate(r));});

test('detail/contact approval preserves both exact A replies and separate earlier single answer',()=>{
 const r=load(),d=r.bannerDetailAndContactDecision;assert.equal(d.date,'2026-10-17');assert.equal(d.sourceCommit,'887828aeff13ccbc9bcf3f68ee75a31dcc045e14');assert.equal(d.scope,'banner-advertising-detail-fields-and-authorized-public-business-contacts');assert.equal(d.responseType,'structured-question-replies');assert.deepEqual(d.responses,expectedDetailResponses);assert.equal(Object.hasOwn(d,'userReply'),false);assert.equal(r.bannerPlaceholderDecision.responses.length,1);
});
test('detail/contact approval changes only detail scope approved contacts and respective pending fields',()=>{
 const r=load(),prior=JSON.parse(at(r.bannerDetailAndContactDecision.sourceCommit,recordPath));delete r.bannerDetailAndContactDecision;delete r.banner.advertisingDetail;r.banner.pendingDetails=structuredClone(prior.banner.pendingDetails);assert.deepEqual(r,prior);
});
test('detail field limits authorization interaction and review update remain unapproved',()=>{
 const b=load().banner;for(const key of ['advertisingDetailFieldSpecifications','advertisingContactAuthorizationInteraction','advertisingDetailReviewAndUpdateRule'])assert.equal(b.pendingDetails[key],null);for(const key of ['advertisingDetailFields','advertisingDetailContactDisclosure'])assert.equal(Object.hasOwn(b.pendingDetails,key),false);assert.equal(b.advertisingDetail.optionalFields.includes('business-phone'),true);
});
test('all document entries state field scope optional authorized phone and resident privacy boundary',()=>{
 for(const file of ["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"]){
  const first=read(file).split(/\r?\n/)[2];for(const phrase of ['Banner详情与联系方式确认（2026-10-17）','逐题选择A、A','必填经营名称、广告标题、宣传说明、经营/服务区域','营业时间、门店详细地址、补充图片选填','首页已审核主图同时展示','经营电话由商家另行选填并明确授权公开后','访客无需登录即可查看和点击拨号','门店详细地址仅在商家授权公开时展示','不取用私下实名资料','不改变居民交易联系方式打码规则','授权交互及详情审核/更新仍待细化','第二版候选规则'])assert(first.includes(phrase),file+': '+phrase);
 }
});
test('detail specification retains actual full questions and replies with no pending old field scope',()=>{const s=read('docs/merchant-pricing-confirmed-20261016.md');for(const r of expectedDetailResponses){assert(s.includes(r.question));assert(s.includes(r.answer));}assert(s.includes('### 3.4'));assert(s.includes('不从账户登录电话、居民交易联系资料或私下实名核验资料自动带入公开字段'));assert(s.includes('不以必填服务区域等同公开详细地址'));assert(!s.includes('两题未收到答复，均保持待确认'));});
test('detail/contact rejects business phone made mandatory',()=>{const r=load();r.banner.advertisingDetail.requiredFields.push('business-phone');assert.throws(()=>validate(r));});
test('detail/contact rejects business hours made mandatory',()=>{const r=load();r.banner.advertisingDetail.requiredFields.push('business-hours');assert.throws(()=>validate(r));});
test('detail/contact rejects detailed address made mandatory',()=>{const r=load();r.banner.advertisingDetail.requiredFields.push('detailed-store-address');assert.throws(()=>validate(r));});
test('detail/contact rejects supplementary images made mandatory',()=>{const r=load();r.banner.advertisingDetail.requiredFields.push('supplementary-images');assert.throws(()=>validate(r));});
test('detail/contact rejects approved main image omitted',()=>{const r=load();r.banner.advertisingDetail.showApprovedHomeMainImage=false;assert.throws(()=>validate(r));});
test('detail/contact rejects phone copied from login profile',()=>{const r=load();r.banner.advertisingDetail.businessPhone.separatelyProvidedByAdvertiser=false;assert.throws(()=>validate(r));});
test('detail/contact rejects public phone requires login',()=>{const r=load();r.banner.advertisingDetail.businessPhone.viewRequiresLogin=true;assert.throws(()=>validate(r));});
test('detail/contact rejects click to call removed',()=>{const r=load();r.banner.advertisingDetail.businessPhone.clickToCall=false;assert.throws(()=>validate(r));});
test('detail/contact rejects store address published without authorization',()=>{const r=load();r.banner.advertisingDetail.detailedStoreAddress.requiresPublicAuthorization=false;assert.throws(()=>validate(r));});
test('detail/contact rejects resident contact masking silently changed',()=>{const r=load();r.banner.advertisingDetail.residentContactMaskingChanged=true;assert.throws(()=>validate(r));});
test('detail/contact rejects unapproved image count invented',()=>{const r=load();r.banner.pendingDetails.advertisingDetailFieldSpecifications={maxImages:9};assert.throws(()=>validate(r));});
test('detail/contact rejects real sale enabled by detail approval',()=>{const r=load();r.bannerDetailAndContactDecision.realSalesAuthorized=true;assert.throws(()=>validate(r));});
