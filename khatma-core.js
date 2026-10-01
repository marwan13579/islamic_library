(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.IslamicKhatma=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const PART_COUNT=30;

  function parseValue(value,fallback){
    if(typeof value!=="string") return value??fallback;
    try{return JSON.parse(value)??fallback;}catch(error){return fallback;}
  }

  function createState(completedValue,assigneesValue,dedicationValue){
    const completed=parseValue(completedValue,[]);
    const assignees=parseValue(assigneesValue,{});
    const validCompleted=Array.isArray(completed)&&completed.length===PART_COUNT?completed:[];
    const validAssignees=assignees&&typeof assignees==="object"&&!Array.isArray(assignees)?assignees:{};
    const juz=Array.from({length:PART_COUNT},(_,index)=>({
      completed:Boolean(validCompleted[index]),
      assignee:typeof validAssignees[index]==="string"?validAssignees[index].trim().slice(0,30):""
    }));
    const participants=[...new Set(juz.map(part=>part.assignee).filter(Boolean))];
    return {participants,juz,dedication:String(dedicationValue??"").slice(0,100)};
  }

  function assign(state,index,name){
    if(!Number.isInteger(index)||index<0||index>=PART_COUNT) return false;
    const assignee=String(name??"").trim().slice(0,30);
    state.juz[index].assignee=assignee;
    if(assignee&&!state.participants.includes(assignee)) state.participants.push(assignee);
    return true;
  }

  function toggle(state,index){
    if(!Number.isInteger(index)||index<0||index>=PART_COUNT) return false;
    state.juz[index].completed=!state.juz[index].completed;
    return state.juz[index].completed;
  }

  function toLegacy(state){
    const completed=Array.from({length:PART_COUNT},(_,index)=>Boolean(state.juz[index]?.completed));
    const assignees={};
    state.juz.forEach((part,index)=>{if(part?.assignee) assignees[index]=String(part.assignee).slice(0,30);});
    return {completed,assignees,dedication:String(state.dedication??"").slice(0,100)};
  }

  function progress(state){
    const completed=state.juz.filter(part=>part.completed).length;
    return {completed,total:PART_COUNT,percent:Math.round(completed/PART_COUNT*100)};
  }

  return Object.freeze({PART_COUNT,createState,assign,toggle,toLegacy,progress});
});
