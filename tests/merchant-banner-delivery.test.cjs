'use strict';
// Validate the approved planning contract; no advertising, payment or real timer is started.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),recordPath='docs/merchant-pricing-confirmed-20261016.json';
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'});
const expectedCarousel={mode:'automatic-with-manual-controls',manualSwipe:true,pauseResumeControl:true,restartIntervalAfterManualSwipe:true,pauseWhenPageNotVisible:true,visibleReturnKeepsCurrentSlide:true,visibleReturnRestartsInterval:true,singleSlideAutoRotation:false};
const expectedActivation={requiresQualificationApproved:true,requiresMaterialApproved:true,requiresScheduleConfirmed:true,requiresPaymentSucceeded:true,requiresActuallyDisplayable:true,start:'confirmed-actual-advertising-start-after-payment-and-display-availability',periodDays:30,paymentAloneStartsClock:false,reviewAloneStartsClock:false};
const expectedPending={reservationRule:null,scheduleConflictRule:null,refundRule:null,paymentChannel:null,emptyPositionDisplayRule:null,initialDefaultTrigger:null,materialSpecification:null,materialCountPerAdvertiser:null,clickTarget:null,deliveryMetricDefinitions:null,expiryAndRenewalRule:null,faultCompensation:null,manualPauseVisibilityPriority:null};
const expectedResponses=[
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",0]',id:'banner-position-capacity',selected:'A',question:'接下来讨论首页Banner的商业交付。保留首图／次图／末图299／249／199元每30天的候选报价，起步同时售卖多少名额？本题不启用正式售卖。',answer:'A（推荐）：同一投放期间共3个位置，每个位置只对应1个广告主；首图默认展示。容易说明交付，也容易核对。'},
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",1]',id:'banner-carousel-behavior',selected:'A',question:'首页Banner采用哪种轮播方式？这是拟议的展示规则，不代表保证每次访问都能看到全部广告。',answer:'A（推荐）：每5秒自动切换，可手动滑动及暂停／继续；手动切换后重新计时，页面不可见时暂停，恢复可见保留当前图重新计时，只有1张时不自动切换。'},
 {questionItemId:'["request_user_input_async","call_e86bc0411b594ceb9592302995bee929",2]',id:'banner-review-payment-activation-order',selected:'A',question:'Banner采用哪种审核、付款和投放起算顺序？本题只决定顺序，名额保留、广告退款与实际支付通道另行确认。',answer:'A（推荐）：先审核广告资格和素材、确认排期，再付款；付款成功且广告实际可展示后，才从确认的实际投放开始时刻计算连续30天。'}
];
function validate(r){
 const b=r.banner,d=r.bannerDeliveryDecision;
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
 ['legacy 15-minute hold revived',r=>r.banner.pendingDetails.reservationRule={minutes:15}],
 ['membership refund copied to ads',r=>r.banner.pendingDetails.refundRule='membership-refund'],
 ['advertising channel invented',r=>r.banner.pendingDetails.paymentChannel='wechat'],
 ['empty-position behavior invented',r=>r.banner.pendingDetails.emptyPositionDisplayRule='fill-with-house-ad'],
 ['manual pause priority silently assumed',r=>r.banner.pendingDetails.manualPauseVisibilityPriority='always-restart'],
 ['all delivery details treated as complete',r=>r.banner.deliveryRulesComplete=true],
 ['formal prices silently activated',r=>r.execution.formalSalePricesApproved=true],
 ['real sales authorized',r=>r.bannerDeliveryDecision.realSalesAuthorized=true],
 ['technical detailing resumed',r=>r.execution.technicalDetailingResumed=true]
])test('Banner contract rejects '+name,()=>{const r=load();mutate(r);assert.throws(()=>validate(r));});

test('new delivery approval preserves every earlier price, reply, membership and billing decision',()=>{
 const r=load(),prior=JSON.parse(at(r.bannerDeliveryDecision.sourceCommit,recordPath));
 const current=structuredClone(r);delete current.bannerDeliveryDecision;
 current.banner.rotationSeconds=null;current.banner.maxAdvertisersPerTier=null;
 for(const key of ['positionCount','carousel','purchaseSequence','activation','pendingDetails'])delete current.banner[key];
 assert.deepEqual(current,prior);
 for(const p of ['docs/merchant-membership-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.md'])assert.equal(read(p).replace(/\r\n/g,'\n'),at(r.bannerDeliveryDecision.sourceCommit,p).replace(/\r\n/g,'\n'),'Membership contract unchanged: '+p);
});

test('all current document entries state the approved capacity, behavior and start order',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file),first=s.split(/\r?\n/)[2];
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
 for(const phrase of ['### 3.1','不是三个独立同时可见的广告区','不将一轮轮播当作已核实展示量','不将点击、联系操作当实际咨询/到店/成交','不保证售满','审核通过或付款成功单独都不能开始投放时钟','名额保留时长','用户手动暂停后隐藏/恢复等优先关系待后续细化','没有批准同一广告主可买多少位置'])assert(s.includes(phrase),phrase);
 assert.equal(30*24*60*60,2592000,'Purchased period is thirty continuous days, not total accumulated on-screen seconds');
});
