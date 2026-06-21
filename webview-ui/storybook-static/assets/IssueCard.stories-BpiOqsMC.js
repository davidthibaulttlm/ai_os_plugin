import{j as u}from"./jsx-runtime-DC_2WrdX.js";import{I as c,D as m,S as l,v as p}from"./IssueCard-B4Y41-F-.js";import"./iframe-BfQM_Kyp.js";import"./preload-helper-CmsKOCeN.js";import"./index-DmtX3LOG.js";const E={title:"Components/IssueCard",component:c,tags:["autodocs"],decorators:[o=>u.jsx(m,{children:u.jsx(l,{items:["item_1"],strategy:p,children:u.jsx(o,{})})})]},e={id:"item_1",type:"ISSUE",title:"Implement user authentication",number:42,status:"AI_SPEC",url:"https://github.com/example/repo/issues/42",repo:"example/repo",priority:"high",labels:["feature","auth"]},s={args:{item:e}},t={args:{item:{...e,id:"pr_1",type:"PULL_REQUEST",title:"Fix login redirect bug",number:15,status:"HUMAN_CODE_REVIEW",url:"https://github.com/example/repo/pull/15",priority:"critical",labels:["bugfix"]}}},r={args:{item:{...e,id:"bug_1",title:"Fix login crash on mobile",number:101,status:"AI_CODE",url:"https://github.com/example/repo/issues/101",labels:["bug","critical"]}}},a={args:{item:{...e,id:"priority_1",title:"First issue in AI_CODE column",number:200,status:"AI_CODE",url:"https://github.com/example/repo/issues/200",labels:["priority/high"]}}},i={args:{item:{...e,id:"item_2",title:"Add dark mode support",number:99,status:"BRAIN_DUMP",url:"https://github.com/example/repo/issues/99",priority:void 0}}},n={args:{item:e},play:async({canvasElement:o})=>{o.querySelector("div[draggable]")?.dispatchEvent(new MouseEvent("click",{bubbles:!0}))}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    item: baseItem
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'pr_1',
      type: 'PULL_REQUEST',
      title: 'Fix login redirect bug',
      number: 15,
      status: 'HUMAN_CODE_REVIEW',
      url: 'https://github.com/example/repo/pull/15',
      priority: 'critical',
      labels: ['bugfix']
    }
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'bug_1',
      title: 'Fix login crash on mobile',
      number: 101,
      status: 'AI_CODE',
      url: 'https://github.com/example/repo/issues/101',
      labels: ['bug', 'critical']
    }
  }
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'priority_1',
      title: 'First issue in AI_CODE column',
      number: 200,
      status: 'AI_CODE',
      url: 'https://github.com/example/repo/issues/200',
      labels: ['priority/high']
    }
  }
}`,...a.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'item_2',
      title: 'Add dark mode support',
      number: 99,
      status: 'BRAIN_DUMP',
      url: 'https://github.com/example/repo/issues/99',
      priority: undefined
    }
  }
}`,...i.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    item: baseItem
  },
  play: async ({
    canvasElement
  }) => {
    // Click verifies the handler dispatches 'selectIssue' IPC message
    const card = canvasElement.querySelector('div[draggable]');
    card?.dispatchEvent(new MouseEvent('click', {
      bubbles: true
    }));
  }
}`,...n.parameters?.docs?.source}}};const x=["Issue","PullRequest","BugLabel","TopPriorityCard","NoPriority","ClickSelectsIssue"];export{r as BugLabel,n as ClickSelectsIssue,s as Issue,i as NoPriority,t as PullRequest,a as TopPriorityCard,x as __namedExportsOrder,E as default};
