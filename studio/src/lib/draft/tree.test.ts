import { describe, expect, it } from "vitest";
import { createNode, findNode, insertNode, moveNode, removeNode, shiftNode, type DraftNode } from "./tree";

function setup() {
  const section = createNode("section");
  const a = createNode("text");
  const b = createNode("button");
  section.children = [a, b];
  const hero = createNode("hero");
  return { tree: [hero, section] as DraftNode[], section, a, b, hero };
}

describe("draft tree", () => {
  it("inserts inside a container and before/after a node", () => {
    const { tree, section, a } = setup();
    const n1 = createNode("image");
    const t1 = insertNode(tree, n1, { kind: "inside", parentId: section.id });
    expect(findNode(t1, section.id)!.children!.at(-1)!.id).toBe(n1.id);
    const n2 = createNode("heading");
    const t2 = insertNode(t1, n2, { kind: "before", targetId: a.id });
    expect(findNode(t2, section.id)!.children![0].id).toBe(n2.id);
    expect(tree[1].children).toHaveLength(2); // imutável
  });

  it("refuses to insert inside a leaf", () => {
    const { tree, hero } = setup();
    expect(insertNode(tree, createNode("text"), { kind: "inside", parentId: hero.id })).toBe(tree);
  });

  it("moves across levels and never into its own descendant", () => {
    const { tree, section, b, hero } = setup();
    const moved = moveNode(tree, b.id, { kind: "before", targetId: hero.id });
    expect(moved[0].id).toBe(b.id);
    expect(findNode(moved, section.id)!.children).toHaveLength(1);
    const inner = createNode("column");
    const withInner = insertNode(tree, inner, { kind: "inside", parentId: section.id });
    expect(moveNode(withInner, section.id, { kind: "inside", parentId: inner.id })).toBe(withInner);
  });

  it("removes and shifts", () => {
    const { tree, section, a, b } = setup();
    expect(findNode(removeNode(tree, a.id), a.id)).toBeUndefined();
    const shifted = shiftNode(tree, b.id, -1);
    expect(findNode(shifted, section.id)!.children!.map((n) => n.id)).toEqual([b.id, a.id]);
  });
});
