import { describe, expect, it } from 'vitest';
import { DialogSystem, type DialogContext } from '../src/game/dialog/DialogSystem';
import { MoralState } from '../src/game/moral/MoralState';
import { StoryFlags } from '../src/game/story/StoryFlags';
import type { DialogDef } from '../src/game/dialog/dialogDefs';

const makeContext = (): DialogContext => ({
  moral: new MoralState(),
  story: new StoryFlags(),
  surrenderEnemy: null,
  rewardSoul: () => {},
});

const linearDef: DialogDef = {
  id: 'test',
  startNode: 'a',
  nodes: {
    a: { speaker: 'A', text: 'hello', options: [{ label: 'next', next: 'b' }] },
    b: { speaker: 'B', text: 'bye' },
  },
};

describe('DialogSystem', () => {
  it('start sets active and exposes start node with first option selected', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    expect(ds.isActive).toBe(true);
    expect(ds.state?.speaker).toBe('A');
    expect(ds.state?.text).toBe('hello');
    expect(ds.state?.options).toEqual([{ label: 'next', selected: true }]);
  });

  it('terminal node without options: confirm closes', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm'); // a -> b
    expect(ds.state?.speaker).toBe('B');
    ds.handleInput('confirm'); // b has no options -> close
    expect(ds.isActive).toBe(false);
    expect(ds.state).toBeNull();
  });

  it('down cycles options forward and wraps', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'pick',
          options: [{ label: '1', next: 'n' }, { label: '2', next: 'n' }, { label: '3', next: 'n' }],
        },
      },
    });
    ds.handleInput('down');
    expect(ds.state?.options[1].selected).toBe(true);
    ds.handleInput('down');
    expect(ds.state?.options[2].selected).toBe(true);
    ds.handleInput('down');
    expect(ds.state?.options[0].selected).toBe(true);
  });

  it('up cycles options backward and wraps', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'pick',
          options: [{ label: '1', next: 'n' }, { label: '2', next: 'n' }],
        },
      },
    });
    ds.handleInput('up');
    expect(ds.state?.options[1].selected).toBe(true);
    ds.handleInput('up');
    expect(ds.state?.options[0].selected).toBe(true);
  });

  it('option with next jumps node and resets selection', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm');
    expect(ds.state?.speaker).toBe('B');
  });

  it('option with action runs handler then closes', () => {
    const ds = new DialogSystem(makeContext());
    let called = false;
    ds.registerAction('doThing', () => {
      called = true;
    });
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'doThing' }] } },
    });
    ds.handleInput('confirm');
    expect(called).toBe(true);
    expect(ds.isActive).toBe(false);
  });

  it('action handler receives context', () => {
    const ctx = makeContext();
    const ds = new DialogSystem(ctx);
    let received: DialogContext | null = null;
    ds.registerAction('grab', (c) => {
      received = c;
    });
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'grab' }] } },
    });
    ds.handleInput('confirm');
    expect(received).toBe(ctx);
  });

  it('option with both next and action throws (mutual exclusion)', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'go',
          options: [{ label: 'bad', next: 'n', action: 'noop' }],
        },
      },
    });
    expect(() => ds.handleInput('confirm')).toThrow();
  });

  it('unregistered action throws', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'missing' }] } },
    });
    expect(() => ds.handleInput('confirm')).toThrow();
  });

  it('close clears state', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('close');
    expect(ds.isActive).toBe(false);
    expect(ds.state).toBeNull();
  });

  it('up/down on node without options does nothing', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm'); // -> b (no options)
    ds.handleInput('down');
    expect(ds.state?.speaker).toBe('B');
    ds.handleInput('up');
    expect(ds.state?.speaker).toBe('B');
  });
});
