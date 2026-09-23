import { describe, it, expect } from "vitest";
import { diffLandingSchoolSelection } from "./superAdminRouter";

/**
 * Sincronização da vitrine de escolas na Landing Page: o que publicar e o que
 * desativar a partir da seleção atual × desejada.
 */
describe("Landing — puxar logos das escolas", () => {
  it("publica as novas e desativa as removidas", () => {
    const { toPublish, toDeactivate } = diffLandingSchoolSelection([1, 2, 3], [3, 4, 5]);
    expect(toPublish.sort()).toEqual([4, 5]);
    expect(toDeactivate.sort()).toEqual([1, 2]);
  });

  it("sem mudanças → nada a fazer", () => {
    const { toPublish, toDeactivate } = diffLandingSchoolSelection([1, 2], [1, 2]);
    expect(toPublish).toEqual([]);
    expect(toDeactivate).toEqual([]);
  });

  it("vitrine vazia → publica toda a seleção", () => {
    const { toPublish, toDeactivate } = diffLandingSchoolSelection([], [7, 8]);
    expect(toPublish.sort()).toEqual([7, 8]);
    expect(toDeactivate).toEqual([]);
  });

  it("seleção vazia → desativa toda a vitrine", () => {
    const { toPublish, toDeactivate } = diffLandingSchoolSelection([1, 2], []);
    expect(toPublish).toEqual([]);
    expect(toDeactivate.sort()).toEqual([1, 2]);
  });

  it("normaliza ids repetidos", () => {
    const { toPublish, toDeactivate } = diffLandingSchoolSelection([1, 1], [1]);
    expect(toPublish).toEqual([]);
    expect(toDeactivate).toEqual([]);
  });
});
