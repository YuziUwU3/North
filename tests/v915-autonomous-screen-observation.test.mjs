import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('realtime screen observation has explicit quiet, question and end decisions',()=>{
  assert.match(app,/共享观察\|继续/);
  assert.match(app,/共享观察\|提问/);
  assert.match(app,/共享观察\|结束/);
  assert.match(app,/function callScreenAutonomyApply\(value\)/);
  assert.match(app,/decision!=='继续'/);
  assert.match(app,/_callScreenObserveMode='waiting'/);
});

test('a user answer resumes or ends observation through the normal call turn',()=>{
  assert.match(app,/function callScreenAutonomyUserAnswered\(text,meta\)/);
  assert.match(app,/const autonomyAnswer=callScreenAutonomyUserAnswered\(t,meta\)/);
  assert.match(app,/用户正在回答你刚才因共享画面而提出的问题/);
  assert.match(app,/_screenShareResumeDecision/);
});

test('manual look requests stay outside the autonomous answer interception',()=>{
  assert.match(app,/callVideoVisionAsked\(text\)\)return false/);
  assert.match(app,/videoVisionManual:manual/);
  assert.match(app,/screenShareAutonomy:live/);
});
