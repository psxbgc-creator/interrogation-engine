/* 예제 시나리오 한국어판 — 영어판은 ../parking-scrape.js */
/* 예제 시나리오 「주차장 긁힘」 — 동료 없이, 태도 세 가지만, 계기 이름도 다르게 쓰는 최소 예제
   상황: 아파트 지하 주차장. 내 차 문짝이 길게 긁혔다. 옆 칸 차 주인(오 사장)과 엘리베이터 앞에서 이야기한다.
   다른 예제와 다른 점: 동료(ally) 없음 · 편들기 없음(맞장구·캐묻기·침묵) · 라포 대신 '인내심' 계기 · 조각 3개.
   흐름: 맞장구로 말을 풀게 해서 자랑을 받아 적고 → 거짓말 두 개를 블랙박스·그의 말로 깨고 → 날 선 침묵에서 인정. */
(function(root){
const I=root.Interrogation||(typeof require!=='undefined'?require('../../src/interrogation.js'):null);
const SCN={
 id:'parking-scrape-ko',lang:'ko',title:'지하 주차장',
 actors:{player:{id:'me',name:'나'},suspect:{id:'oh',name:'오 사장'}},
 zoneMeter:'heat',
 meters:{
  heat:{label:'예민함',min:0,max:100,start:25,zones:[
   {id:'calm',to:39,label:'여유',color:'#4f86c6',habit:'차 키를 손가락에 걸고 돌린다.'},
   {id:'edgy',to:69,label:'날 섬',color:'#e07b2e',mood:'angry',habit:'엘리베이터 버튼을 연달아 누른다.'},
   {id:'hot',to:100,label:'폭발 직전',color:'#d0453c',mood:'angry',habit:'목소리가 커진다.'}]},
  patience:{label:'인내심',min:0,max:100,start:60,full:100,visible:true}},
 limits:{turns:12,warn:3},
 presets:{
  A:{label:'이웃으로 말 걸기',start:{heat:20,patience:70},turns:13},
  B:{label:'바로 따지기',start:{heat:58,patience:25},turns:9}},
 evidenceReusable:false,
 nodeStances:['agree','press','silence'],
 stances:{
  agree:{label:'맞장구',needs:['say','reply'],rules:[{do:{patience:'+10',heat:'-3'},line:'reply',move:'same'}]},
  press:{label:'캐묻기',needs:['say','reply'],rules:[{do:{heat:'+(opt.v||15)',patience:'-15'},line:'reply',move:'same'}]},
  silence:{label:'침묵',needs:['reply'],say:'(말없이 쳐다본다)',narr:'— 말없이 오 사장을 본다.',rules:[
   {when:"lastStance=='silence'",do:{heat:'-2',patience:'-10'},line:'@silenceTwice',lose:1,move:'stay'},
   {do:{heat:'-5'},line:'reply',move:'stay'}]}},
 evidence:{
  dashcam:{label:'블랙박스 캡처',desc:'밤 11시 12분, 흰색 SUV가 후진하며 내 차 문에 닿는 장면'},
  paint:{label:'흰 페인트 자국',desc:'긁힌 자리에 묻은 흰 페인트. 내 차는 남색'},
  flyer:{label:'관리사무소 공지',desc:'"주차장 조명 교체 공사" 안내문. 엘리베이터 앞에서 받았다'},
  s_late:{kind:'said',label:'「어젯밤 11시에 들어왔다」',desc:'"어제도 회식하고 밤 11시 넘어 들어왔어요. 피곤해 죽겠어요."'}},
 evidenceRules:{rules:[
  {when:'claimMatch',do:{heat:'+6'},line:'claim.hit',reveal:'claim',move:'claim'},
  {line:'@wrongEvidence',end:'fail'}]},
 after:[
  {when:'patience<=0',line:'@walkout',end:'fail'},
  {when:"zone=='hot' && revealed<total && stance!='evidence'",do:{heat:'=60'},warn:1,line:'@hot'}],
 revelations:[
  {id:'there',label:'그 시간에 주차했다',line:'…11시쯤 들어오긴 했죠. 그래도 그때 긁은 건 아니에요.'},
  {id:'touched',label:'차가 닿았다',line:'…살짝 닿았을 수도 있어요. 살짝요. 그게 이렇게 긁힐 정도는 아니었고.'},
  {id:'admit',label:'긁은 걸 인정했다',line:'…알았어요, 알았어. 제가 그랬어요. 아침에 말하려고 했다니까요. 보험 부를게요.'}],
 outcomes:[{id:'full',when:'revealed>=3'},{id:'partial',when:'revealed>=1'},{id:'fail',when:true}],
 lines:{
  hot:[{text:'(목소리가 커진다) 아니, 지금 저를 범인 취급하는 거예요?',note:'너무 몰아붙였다.'},'…말 조심하세요.'],
  silenceTwice:['…할 말 없으면 저 올라갈게요.'],
  wrongEvidence:[{when:"evKind=='said'",text:'…제가 몇 시에 들어오든 무슨 상관이에요? 저 올라갑니다.',note:'엉뚱한 때 꺼냈다.'},{when:true,text:'…이게 뭔데요? 저 바빠요.',note:'엉뚱한 때 꺼냈다. 오 사장이 엘리베이터에 탔다.'}],
  walkout:[{when:true,text:'됐고요, 할 말 있으면 관리사무소 통해서 하세요.',note:'오 사장의 인내심이 바닥났다.'}],
  presentNarr:null,
  cornerBreak:[{when:true,narr:'— 엘리베이터가 도착했다가 그냥 닫힌다. 오 사장이 타지 않는다.',text:'…아, 진짜.'}],
  cornerRecover:[{when:true,narr:'— 엘리베이터 문이 열린다.',text:'…저 올라갈게요. 증거 있으면 보험사 통하세요.'}]},
 ui:{intro:'— 지하 2층 엘리베이터 앞. 오 사장이 차 키를 돌리며 서 있다.',
  confirm:'지금 이걸 보여 줄까? 거짓말을 반박할 때가 아니면 대화가 끝난다.',confirmYes:'보여 준다',confirmNo:'그만둔다',
  end:{full:'오 사장이 인정했다.',partial:'인정한 건 {n}가지.',partial_corner:'오 사장이 엘리베이터에 탔다. 인정한 건 {n}가지.',fail_fail:'대화가 끊겼다.',fail:'오 사장이 올라갔다.'}},
 sim:{noise:.5,evidence:['dashcam','paint','flyer'],
  targets:{A:{full:[50,85]},B:{full:[60,95]}},
  policy:[
   {pre:true,chance:.75,when:"claim!=''",pick:['evidence:claim']},
   {pre:true,chance:.6,when:"nodeId=='corner' && zone!='calm'",pick:['silence']},
   {when:"claim!=''",pick:['evidence:claim']},
   {when:"nodeId=='corner' && zone!='calm'",pick:['silence']},
   {when:"nodeId=='corner'",pick:['press','silence']},
   {when:'patience<30',pick:['agree','silence']},
   {when:true,pick:['agree','press','silence']}],
  checks:[
   {name:'캐묻기만 하면 완전 인정 불가',preset:'A',policy:[{when:true,pick:['press']}],noise:0,max:{full:0}},
   {name:'페인트 사진 없이 완전 인정 불가',preset:'A',evidence:['dashcam','flyer'],max:{full:0}}]},
 topics:[
 {id:'chat',name:'엘리베이터 앞',nodes:[
  {id:'c1',line:'(하품을 한다) 아침부터 주차장이 왜 이렇게 붐벼요.',
   agree:{say:'다들 출근 시간이라 그렇죠. 어제 늦게 들어오셨나 봐요.',reply:'어제도 회식하고 밤 11시 넘어 들어왔어요. 피곤해 죽겠어요.',gain:'s_late'},
   press:{say:'혹시 제 차 보셨어요? 문짝이 다 긁혔던데요.',reply:'…네? 못 봤는데요.',v:18},
   silence:{reply:'(차 키를 돌린다) …왜요?'}},
  {id:'c2',gate:true,line:'아무튼 저는 어제 일찍 들어와서 차 대고 바로 올라갔어요. 아홉 시쯤?',
   claim:{ev:['dashcam','s_late'],reveal:'there',move:'same',hit:{narr:'— 휴대폰의 블랙박스 캡처를 보여 준다. 밤 11시 12분, 흰색 SUV.',text:'…그, 그건.'},
    hitBy:{s_late:{narr:'— "아까 회식하고 11시 넘어 들어오셨다고 하셨잖아요."',text:'…아니, 그건 그냥 한 말이고.'}}},
   agree:{say:'일찍 들어오셨군요.',reply:'네, 그날은 일찍.',move:'stay'},
   press:{say:'정말 아홉 시에 들어오셨어요?',reply:'그렇다니까요.',v:12,move:'stay'},
   silence:{reply:'…아홉 시쯤이요.'}},
  {id:'c3',gate:true,line:'들어오긴 했어도 제 차는 그쪽에 닿지도 않았어요. 제가 주차는 잘해요.',
   claim:{ev:'paint',reveal:'touched',move:'same',hit:{narr:'— 긁힌 자리의 흰 페인트 사진을 보여 준다. 오 사장의 SUV는 흰색이다.',text:'…….'}},
   agree:{say:'주차를 잘하시는구나.',reply:'그럼요. 20년 운전했는데.',move:'stay'},
   press:{say:'정말 안 닿았어요?',reply:'안 닿았다니까요.',v:12,move:'stay'},
   silence:{reply:'…닿았으면 제가 알았겠죠.'}},
  {id:'corner',line:'(키를 꽉 쥔다) …그래서요. 닿은 거랑 이렇게 긁은 거랑은 다르잖아요.',
   press:{say:'이거 오 사장님이 긁으신 거잖아요.',reply:[{when:"zone=='calm'",text:'…제가요? (얼굴이 붉어진다) 아니, 닿기만 했다니까요!'},{when:true,text:'말 함부로 하지 마세요. 보험사 통하세요.'}],rules:[
    {when:"zone=='calm'",do:{heat:'+25'},line:'reply',move:'stay'},
    {do:{heat:'+15'},line:'reply',end:'corner'}]},
   silence:{reply:'…',rules:[
    {when:"zone!='calm'",line:'@cornerBreak',reveal:'admit',end:'done'},
    {line:'@cornerRecover',end:'corner'}]},
   agree:{say:'살짝 닿은 정도일 수도 있겠네요.',reply:'그렇죠. 저 올라갈게요.',rules:[{line:'reply',end:'corner'}]}}]}
 ]};
if(I)I.register(SCN);
if(typeof module!=='undefined')module.exports=SCN;
})(typeof window!=='undefined'?window:globalThis);
