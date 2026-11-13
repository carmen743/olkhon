/* 알혼커피 근무표 — 저장소
   지금: 이 기기 브라우저(localStorage)에만 저장.
   다음 단계: Supabase 등 공유 DB로 바꾸면 세 사람이 같은 근무표를 봐요. (load/save만 교체) */
(function(){
  const KEY='olkhon-schedule-v1';
  const DEFAULT={
    members:[
      {id:'m1',name:'다후',color:'#3549a6',target:0},
      {id:'m2',name:'밍나',color:'#93b23f',target:0},
      {id:'m3',name:'밍구',color:'#e07a5f',target:0}
    ],
    shifts:[
      {id:'open',name:'오픈',start:'08:00',end:'14:00',need:1},
      {id:'close',name:'마감',start:'14:00',end:'21:00',need:1}
    ],
    closedDays:[],closedOverride:{},assign:{},off:{},notes:{},updated:null
  };
  window.Store={
    shared:false,
    load(){
      try{const raw=localStorage.getItem(KEY);if(raw)return Object.assign(JSON.parse(JSON.stringify(DEFAULT)),JSON.parse(raw))}catch(e){}
      return JSON.parse(JSON.stringify(DEFAULT));
    },
    async save(state){localStorage.setItem(KEY,JSON.stringify(state))}
  };
})();
