/* 예제 시나리오 한국어판 — 영어판은 ../office-envelope.js */
/* 예제 시나리오 「회비 봉투」 — 엔진이 다른 주제에서도 그대로 도는지 보여 주는 짧은 심문
   상황: 사무실 금고에서 친목회 회비 봉투(48만 원)가 사라졌다. 총무 한정우 대리와 탕비실에서 커피를 마신다.
   흐름: ① 맞장구로 라포 → 자랑 두 마디가 수첩에 남는다
        ② 동기 미나의 신호①("회비 봉투 아직 못 찾았어요?") → 거짓말 세 개(열쇠·퇴근·봉투)를 증거나 그의 말로 깬다
        ③ 미나의 신호②("제가 봤어요") → "세기만 했다" 거짓말 → ATM 확인증으로 깨면 코너
        ④ 날이 선 상태에서 침묵하면 "빌린 거예요"라며 축소 자백(완전). 다그치면 입을 닫는다(반쪽).
   공장장 시나리오(foreman.js)와 같은 규칙 틀을 쓰고, 대사·증거·수치만 다르다. */
(function(root){
const I=root.Interrogation||(typeof require!=='undefined'?require('../../src/interrogation.js'):null);
const CL=(ev,o)=>({ev,...o});
const SCN={
 id:'office-envelope-ko',lang:'ko',title:'탕비실',
 actors:{player:{id:'me',name:'나'},suspect:{id:'han',name:'한정우'},ally:{id:'mina',name:'미나'}},
 zoneMeter:'tension',
 meters:{
  tension:{label:'심리선',min:0,max:100,start:30,graph:true,zones:[
   {id:'blue',to:24,label:'느긋함',color:'#4f86c6',mood:'happy',habit:'커피를 홀짝인다.'},
   {id:'gold',to:59,label:'말이 많아짐',color:'#d9a92b',mood:'smug',habit:'묻지도 않은 말을 덧붙인다.'},
   {id:'orange',to:84,label:'날 선 구역',color:'#e07b2e',mood:'suspicious',habit:'종이컵을 구긴다.'},
   {id:'red',to:100,label:'폭발 직전',color:'#d0453c',mood:'angry',habit:'의자를 뒤로 민다.'}]},
  rapport:{label:'라포',min:0,max:100,start:0,full:50,visible:true},
  suspicion:{label:'의심',min:0,max:100,start:0,visible:false,cues:[{at:60,habit:'웃음기 없이 나를 본다.'}]}},
 limits:{turns:18,warn:4},
 presets:{
  A:{label:'친한 동료처럼',start:{tension:28,rapport:15,suspicion:0},turns:20},
  B:{label:'감사팀으로',start:{tension:50,rapport:0,suspicion:40},turns:16}},
 evidenceReusable:false,
 nodeStances:['agree','press','defend','silence'],
 stances:{
  agree:{label:'맞장구',needs:['say','reply'],rules:[
   {when:'rapport>=full_rapport',do:{suspicion:'+22',tension:'-3'},line:'@suspect',move:'same'},
   {do:{rapport:'+25',suspicion:'-4',tension:'+3'},line:'reply',move:'same'}]},
  press:{label:'파고들기',needs:['say','reply'],rules:[
   {do:{tension:'+(opt.v||12)',rapport:'-10',suspicion:'+(rapport<30?6:0)'},line:'reply',move:'same'}]},
  defend:{label:'편들기',needs:['say','burst','cold'],rules:[
   {when:'rapport<30',do:{suspicion:'+20',tension:'+6',rapport:'-5'},line:'cold',move:'same'},
   {do:{tension:'=max(tension,min(82,max(tension+8,64)))',rapport:'-25',suspicion:'-30'},sfx:'thud',line:'burst',mood:'angry',move:'same'}]},
  silence:{label:'침묵',needs:['reply'],say:'(말없이 기다린다)',narr:'— 말없이 기다린다.',rules:[
   {when:"lastStance=='silence'",do:{tension:'-3'},line:'@silenceTwice',lose:1,move:'stay'},
   {do:{tension:'-7'},line:'reply',move:'stay'}]}},
 evidence:{
  keybook:{label:'열쇠함 대장',desc:'금고 열쇠 대출 칸에 한정우 서명'},
  badge:{label:'출입 기록',desc:'그날 21시 40분 퇴실, 한정우 사원증'},
  cctv:{label:'복도 CCTV 캡처',desc:'20시 52분, 봉투를 들고 탕비실로 가는 한정우'},
  atm:{label:'ATM 입금 확인증',desc:'파쇄함에서 나온 종이. 22시 05분, 48만 원 입금'},
  receipt:{label:'커피 영수증',desc:'그날 오후 탕비실 앞 카페, 아메리카노 두 잔'},
  s_key:{kind:'said',label:'「금고 열쇠는 내가 들고 다닌다」',desc:'"총무 일은 제가 다 해요. 금고 열쇠도 제가 들고 다니고요."'},
  s_late:{kind:'said',label:'「어제도 불은 내가 껐다」',desc:'"요즘 매일 야근이에요. 어제도 사무실 불은 제가 껐을걸요."'}},
 evidenceRules:{rules:[
  {when:'claimMatch',do:{tension:'+4'},sfx:'thud',line:'claim.hit',mood:'suspicious',reveal:'claim',move:'claim'},
  {line:'@wrongEvidence',mood:'angry',end:'fail'}]},
 ally:{label:'미나 신호',uses:[
  {when:"topic=='talk'",label:'미나 신호 ①',prompt:'미나에게 첫 번째 신호를 보낸다',cue:'— 미나에게 눈짓을 한다. 약속한 신호다.',say:'대리님, 회비 봉투 아직 못 찾았어요?',v:10,rules:[
   {when:'rapport<30',do:{suspicion:'+30',tension:'+15'},flag:{allyOut:'=1'},line:'@allyRude',move:'topic:money'},
   {do:{tension:'+10'},line:'@allyGood',move:'topic:money'}]},
  {when:"allyUses==1",label:'미나 신호 ②',prompt:'미나에게 두 번째 신호를 보낸다',cue:'— 다시 미나를 본다. 두 번째 신호.',say:'…대리님. 저 그날 봤어요. 대리님이 봉투에서 돈 꺼내는 거.',v:12,rules:[
   {when:'revealed.open',do:{tension:'+12'},move:'node:counted'},
   {do:{suspicion:'+25',tension:'+10'},flag:{allyOut:'=1'},line:'@allyWasted',mood:'angry'}]}]},
 after:[
  {when:'suspicion>=100',do:{suspicion:'=45',rapport:'-25',tension:'=max(tension,62)'},warn:1,lose:1,line:'@guard',mood:'suspicious'},
  {when:"rapport<=0 && topic!='talk'",line:'@walkout',mood:'angry',end:'fail'},
  {when:"zone=='red' && revealed<total && stance!='evidence' && stance!='ally'",do:{tension:'=72'},warn:1,shake:true,line:'@red',mood:'angry'}],
 revelations:[
  {id:'key',label:'금고 열쇠를 갖고 있었다',line:'…제가 갖고 있긴 해요. 총무니까요. 그래도 금고는 안 열었어요.',mood:'smug'},
  {id:'late',label:'그날 늦게까지 남았다',line:'…좀 늦게까지 있었어요. 정산할 게 있어서요. 그게 다예요.',mood:'sweat'},
  {id:'open',label:'봉투를 열었다',line:'…열어 보긴 했어요. 금액 맞나 세어 보려고요. 총무가 그것도 못 해요?',mood:'sweat'},
  {id:'took',label:'돈을 꺼냈다',line:'…빌린 거예요. 카드값이 밀려서요. 월급날 바로 넣으려고 했다고요. 진짜예요. …진짜로.',mood:'broken'}],
 outcomes:[{id:'full',when:'revealed>=4'},{id:'partial',when:'revealed>=2'},{id:'fail',when:true}],
 lines:{
  suspect:[{when:'suspicion<50',text:'하하, 오늘 왜 이렇게 저를 띄워 줘요?',mood:'smug'},{when:true,text:'(웃음이 사라진다) 뭐 원하는 거 있어요?',mood:'suspicious'}],
  guard:[{when:true,text:'…저 이제 자리 가 봐야 해요. (종이컵을 내려놓는다)',note:'한 대리가 경계하기 시작했다.'}],
  red:['(목소리가 높아진다) 지금 저 의심하는 거예요?',{text:'(의자를 뒤로 민다) 이런 얘기 할 거면 팀장님 모시고 하세요.',note:'너무 몰아붙였다. 한 발 물러설 때.'},'…왜 자꾸 그걸 물어요?'],
  stall:['그 얘긴 그만하죠. (커피를 마신다)','…갑자기 왜요?'],
  silenceTwice:['…할 말 없으면 저 먼저 일어날게요. (시간이 흘러간다)'],
  wrongEvidence:[{when:"evKind=='said'",narr:'— 아까 그가 한 말을 수첩에서 읽는다.',text:'…그래서요? 그게 뭐요. 제 말을 적고 있었어요? 저 갈게요.',note:'엉뚱한 때 꺼냈다.'},{when:true,narr:'— 한 대리가 내민 것을 보고 얼굴이 굳는다.',text:'…이게 뭔데요? 저 지금 조사받는 거예요? 갈게요.',note:'엉뚱한 때 꺼냈다. 한 대리가 입을 닫았다.'}],
  walkout:[{when:true,text:'저 바빠서요. 먼저 갈게요.',note:'한 대리의 마음이 닫혔다.'}],
  presentNarr:null,
  afterReveal:['— 한 대리가 종이컵을 만지작거린다.','— 한 대리가 넥타이를 고쳐 맨다.','— 한 대리가 창밖을 본다.'],
  allyGood:[{when:true,text:'…(웃음이 굳는다) 아, 그거. 팀장님이 찾고 계신대요.',mood:'smug',after:'— 미나는 대답 없이 커피를 젓는다. 한 대리가 내 쪽을 본다.'}],
  allyRude:[{when:true,text:'(컵을 탁 내려놓는다) 미나 씨, 그 얘기를 왜 여기서 해요?',mood:'angry',after:'— 미나가 머쓱하게 자리를 뜬다. 너무 일렀다.'}],
  allyWasted:[{when:true,text:'…뭘 봐요? 미나 씨, 말 함부로 하지 마요.',mood:'angry',after:'— 미나가 자리를 뜬다.'}],
  cornerBreak:[{when:true,narr:'— 침묵이 길어진다. 탕비실 냉장고 소리만 들린다.',text:'…아니, 왜 아무 말도 안 해요.',mood:'sweat'}],
  cornerRecover:[{when:true,narr:'— 침묵이 길어진다.',text:'…(숨을 고른다) 할 말 없으면 저 갈게요. 저는 할 만큼 했어요.',mood:'smug'}]},
 ui:{intro:'— 탕비실. 한 대리가 종이컵 두 개를 내려놓는다. 미나는 정수기 옆에 서 있다.',
  confirm:'지금 이걸 내밀까? 거짓말을 반박할 때가 아니면 대화가 끝난다. 한 번 내면 다시 못 낸다.',confirmYes:'내민다',confirmNo:'그만둔다',
  end:{full:'네 조각이 모두 나왔다.',partial:'나온 조각은 {n}개.',partial_corner:'한 대리가 입을 닫았다. 나온 조각은 {n}개.',fail_fail:'대화가 끊겼다.',fail_blocked:'한 대리가 자리로 돌아갔다.',fail:'점심시간이 끝났다.'}},
 sim:{noise:.5,evidence:['keybook','badge','cctv','atm','receipt'],
  targets:{A:{full:[45,80]},B:{full:[20,55]}},
  policy:[
   {pre:true,chance:.75,when:"claim!=''",pick:['evidence:claim']},
   {pre:true,chance:.6,when:"nodeId=='corner' && (zone=='orange' || zone=='red')",pick:['silence']},
   {pre:true,chance:.7,when:"topic=='talk' && rapport>=40",pick:['ally']},
   {pre:true,chance:.9,when:"nodeId=='t3'",pick:['ally']},
   {pre:true,chance:.7,when:"nodeId=='m4' && allyUses==1",pick:['ally']},
   {when:"claim!=''",pick:['evidence:claim']},
   {when:"nodeId=='corner' && (zone=='orange' || zone=='red')",pick:['silence']},
   {when:"nodeId=='corner'",pick:['defend','silence']},
   {when:"topic=='talk'",pick:['agree','silence']},
   {when:'rapport<25',pick:['agree','silence']},
   {when:true,pick:['press','agree','silence']}],
  checks:[
   {name:'맞장구만 치면 완전 자백 불가',preset:'A',policy:[{when:true,pick:['agree','silence']}],noise:0,max:{full:0}},
   {name:'CCTV 없이 완전 자백 불가',preset:'A',evidence:['keybook','badge','atm','receipt'],max:{full:0}}]},
 topics:[
 {id:'talk',name:'잡담',nodes:[
  {id:'t1',line:'요즘 총무 일 때문에 정신이 없어요. 회비 걷는 것도 다 제 일이고.',
   agree:{say:'총무 일을 혼자 다 하시니 대단하세요.',reply:'그렇죠? 총무 일은 제가 다 해요. 금고 열쇠도 제가 들고 다니고요. 남한테 못 맡겨요.',gain:'s_key'},
   press:{say:'회비는 어디에 보관하세요?',reply:'…금고죠. 왜요?',v:15},
   defend:{say:'회비 안 낸 사람들 때문에 힘드시겠어요.',burst:'힘들죠! 다들 내가 무슨 수금원인 줄 알아!',cold:'다 그렇죠, 뭐.'},
   silence:{reply:'(커피를 홀짝인다) …오늘 말이 없으시네.'}},
  {id:'t2',line:[{when:"lastStance=='agree'",text:'알아주는 사람이 있네. 요즘 정산까지 겹쳐서요.'},{when:true,text:'아무튼 요즘 정산까지 겹쳐서요.'}],
   agree:{say:'정산 시즌이면 매일 늦으시겠어요.',reply:'그러니까요. 다들 칼퇴하는데.',move:'same'},
   press:{say:'정산은 보통 몇 시까지 하세요?',reply:'…그때그때 달라요.',v:12},
   defend:{say:'그 정도면 수당이라도 따로 받으셔야죠.',burst:'수당은 무슨! 회사가 그런 거 챙겨 줘요?',cold:'수당은 없어요.'},
   silence:{reply:'요즘 매일 야근이에요. 어제도 사무실 불은 제가 껐을걸요. 하하.',gain:'s_late'}},
  {id:'t3',line:'아무튼, 커피 잘 마셨어요. 저 슬슬 자리로—',
   agree:{say:'네, 들어가 보세요.',reply:'다음에 또 마셔요.'},
   press:{say:'잠깐만요, 하나만 더요.',reply:'뭔데요? 빨리요.',v:10},
   defend:{say:'미나 씨도 할 말이 있다던데요.',burst:'미나 씨가 무슨 할 말이요!',cold:'미나 씨가요?'},
   silence:{reply:'(시계를 본다) …'}}]},
 {id:'money',name:'회비',requires:'allyUses>=1',blocked:{text:'자, 저 들어가 볼게요. 커피 잘 마셨어요.',note:'미나에게 신호를 보내지 못했다.'},nodes:[
  {id:'m1',gate:true,line:[{when:'flags.allyOut',text:'(미나가 나간 쪽을 보다가) 봉투요? 금고 열쇠는 팀장님만 있어요. 저는 몰라요.'},{when:true,text:'봉투요? 금고에 있었는데. 열쇠는 팀장님만 있어요. 저는 몰라요.'}],
   claim:CL(['keybook','s_key'],{reveal:'key',move:'same',hit:{narr:'— 열쇠함 대장을 내민다. 금고 열쇠 대출 칸, 한정우 서명.',text:'…이걸 언제 봤어요.'},
    hitBy:{s_key:{narr:'— 수첩을 편다. "아까 그러셨죠. 금고 열쇠도 직접 들고 다니신다고."',text:'…(웃음이 굳는다) 그건, 말이 그렇다는 거죠.'}}}),
   agree:{say:'그럼 팀장님께 여쭤봐야겠네요.',reply:'그렇죠. 저는 몰라요.',move:'stay'},
   press:{say:'정말 열쇠가 없으세요?',reply:'없다니까요.',v:10,move:'stay'},
   defend:{say:'총무님이 모르시면 아무도 모르겠네요.',burst:'그걸 왜 제가 다 알아야 돼요!',cold:'저도 몰라요.',move:'stay'},
   silence:{reply:'…열쇠는 팀장님이 갖고 계세요.'}},
  {id:'m2',gate:true,line:'아무튼 그날은 일찍 퇴근했어요. 여섯 시 반쯤? 금고 쪽엔 가지도 않았고요.',
   claim:CL(['badge','s_late'],{reveal:'late',move:'same',hit:{narr:'— 출입 기록을 내민다. 21시 40분 퇴실, 한정우 사원증.',text:'…그, 그건….'},
    hitBy:{s_late:{narr:'— 수첩을 편다. "어제도 사무실 불은 직접 끄셨다면서요."',text:'…아니, 그건 말이 그렇다는 거고.'}}}),
   agree:{say:'일찍 들어가셨군요.',reply:'네, 그날은 일이 없어서요.',move:'stay'},
   press:{say:'정말 여섯 시 반에 나가셨어요?',reply:'그렇다니까요.',v:10,move:'stay'},
   defend:{say:'그날 늦게까지 있던 사람이 범인이겠네요.',burst:'범인이요? 무슨 말을 그렇게 해요!',cold:'그렇겠죠.',move:'stay'},
   silence:{reply:'…여섯 시 반이요.'}},
  {id:'m3',gate:true,line:'남아 있긴 했어도 봉투는 손도 안 댔어요. 금고는 그대로였고요.',
   claim:CL('cctv',{reveal:'open',move:'same',hit:{narr:'— 복도 CCTV 캡처를 내민다. 20시 52분, 봉투를 들고 탕비실로 가는 한정우.',text:'…….'}}),
   agree:{say:'금고가 그대로였다면 다행이네요.',reply:'그렇죠. 저는 손 안 댔어요.',move:'stay'},
   press:{say:'정말 손도 안 대셨어요?',reply:'안 댔다니까요.',v:10,move:'stay'},
   defend:{say:'봉투가 사라졌으니 총무님만 곤란해지겠네요.',burst:'그러니까 제가 왜 곤란해야 하냐고요!',cold:'곤란하죠.',move:'stay'},
   silence:{reply:'…금고는 그대로였어요.'}},
  {id:'m4',line:'아무튼 돈은 그대로 넣어 놨어요. 누가 그 뒤에 가져갔겠죠.',
   agree:{say:'그 뒤에 누가 손댔을 수도 있겠네요.',reply:'그렇죠. 저도 피해자예요.',move:'stay'},
   press:{say:'그 뒤에 금고를 연 사람이 있었나요?',reply:'제가 어떻게 알아요.',v:12,move:'stay'},
   defend:{say:'미나 씨가 그날 늦게까지 있었다던데요.',burst:'…미나 씨가요? 그럼 미나 씨한테 물어보세요!',cold:'미나 씨가요?',move:'stay'},
   silence:{reply:'(시계를 본다) …저 진짜 가 봐야 해요.'}},
  ]},
 /* 미나의 신호②로만 열리는 마지막 화제 */
 {id:'confront',name:'목격',requires:'allyUses>=2 && !flags.allyOut',blocked:{text:'자, 저 들어가 볼게요. 할 얘기는 다 한 것 같네요.',note:'마지막 한 걸음이 모자랐다.'},nodes:[
  {id:'counted',line:'(컵을 내려놓는다) 미나 씨, 말 함부로 하지 마요! 세기만 했다니까요. 세고 바로 다시 넣었어요!',mood:'angry',
   claim:CL('atm',{move:'node:corner',hit:{narr:'— ATM 입금 확인증을 내민다. 파쇄함에서 나온 종이. 22시 05분, 48만 원.',text:'…그, 그건 제 돈이에요.'}}),
   agree:{say:'…그러셨군요.',reply:'그렇다니까요. 저 가 볼게요.',rules:[{line:'reply',end:'corner'}]},
   press:{say:'정말 다시 넣으셨어요?',reply:'몇 번을 말해요!',v:10,move:'stay'},
   defend:{say:'미나 씨가 왜 거짓말을 하겠어요.',burst:'미나 씨가 날 모함하는 거예요!',cold:'미나 씨 말을 믿어요?',move:'stay'},
   silence:{reply:'…다시 넣었어요. 진짜로.'}},
  {id:'corner',line:'(손이 떨린다) …그래서요. 그게 회비라는 증거 있어요? 액수가 같을 수도 있잖아요.',mood:'sweat',
   press:{say:'회비 꺼내서 입금하셨잖아요.',reply:'말 조심해요! …인사팀 부르세요. 더는 말 안 해요.',rules:[{do:{tension:'+15'},line:'reply',mood:'angry',end:'corner'}]},
   silence:{reply:'…',rules:[
    {when:"zone=='orange' || zone=='red'",line:'@cornerBreak',reveal:'took',end:'done'},
    {line:'@cornerRecover',end:'corner'}]},
   agree:{say:'우연일 수도 있겠네요.',reply:'…그렇죠. 우연이에요. 저 갈게요.',rules:[{line:'reply',end:'corner'}]},
   defend:{say:'이대로면 그날 남아 있던 미나 씨가 의심받아요.',burst:'…미나 씨는 상관없잖아요.',cold:'…미나 씨는 상관없잖아요.',rules:[{do:{tension:'+8'},line:'burst',move:'stay'}]}}]}
 ]};
if(I)I.register(SCN);
if(typeof module!=='undefined')module.exports=SCN;
})(typeof window!=='undefined'?window:globalThis);
