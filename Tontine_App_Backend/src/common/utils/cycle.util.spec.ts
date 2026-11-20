import { Regularite, StatutCycle, StatutJourCotisation } from '../enums';
import {
  repartirCoefficients,
  calculerProchaineEcheance,
  construireCycle,
  TOTAL_JOURS_CYCLE,
} from './cycle.util';
import {
  decomposerISO,
  formatISO,
  nombreJoursMois,
  nbJoursCycle,
} from './dates.util';

// ─── repartirCoefficients ────────────────────────────────────────────────────

describe('repartirCoefficients', () => {
  it.each([
    ['mois de 28 jours', 28],
    ['mois de 29 jours (bissextile)', 29],
    ['mois de 30 jours', 30],
    ['mois de 31 jours', 31],
  ])(
    'donne une somme de coefficients toujours égale à 31 (%s)',
    (_libelle, nb) => {
      const coeffs = repartirCoefficients(nb, 1);
      expect(coeffs).toHaveLength(nb);
      expect(coeffs.reduce((s, c) => s + c, 0)).toBe(TOTAL_JOURS_CYCLE);
    },
  );

  it('concentre les coefficients 2 sur les derniers jours d’un mois de 28', () => {
    // 28 jours → 3 jours en plus → les 3 derniers jours passent à 2.
    const coeffs = repartirCoefficients(28, 1);
    expect(coeffs.slice(0, 25)).toEqual(new Array(25).fill(1));
    expect(coeffs.slice(25)).toEqual([2, 2, 2]);
  });

  it('met un seul coefficient 2 sur le dernier jour d’un mois de 30', () => {
    const coeffs = repartirCoefficients(30, 1);
    expect(coeffs.slice(0, 29)).toEqual(new Array(29).fill(1));
    expect(coeffs[29]).toBe(2);
  });

  it('laisse tous les coefficients à 1 pour un mois de 31', () => {
    expect(repartirCoefficients(31, 1)).toEqual(new Array(31).fill(1));
  });

  it('reste à 31 même pour un cycle court (inscription en milieu de mois)', () => {
    // 7 jours de cycle → somme 31 : coefficients plus élevés sur la fin.
    const coeffs = repartirCoefficients(7, 25);
    expect(coeffs).toHaveLength(7);
    expect(coeffs.reduce((s, c) => s + c, 0)).toBe(TOTAL_JOURS_CYCLE);
    // Les derniers jours portent les coefficients les plus élevés.
    const max = Math.max(...coeffs);
    expect(coeffs[coeffs.length - 1]).toBe(max);
  });
});

// ─── dates util ──────────────────────────────────────────────────────────────

describe('dates util', () => {
  it('nombreJoursMois gère février bissextile et non bissextile', () => {
    expect(nombreJoursMois(2024, 1)).toBe(29); // février 2024
    expect(nombreJoursMois(2023, 1)).toBe(28); // février 2023
    expect(nombreJoursMois(2026, 0)).toBe(31); // janvier
    expect(nombreJoursMois(2026, 3)).toBe(30); // avril
  });

  it('nbJoursCycle compte dateFin incluse', () => {
    expect(nbJoursCycle('2026-11-01', '2026-11-30')).toBe(30);
    expect(nbJoursCycle('2026-11-15', '2026-11-30')).toBe(16);
    expect(nbJoursCycle('2026-02-01', '2026-02-28')).toBe(28);
  });

  it('decomposerISO / formatISO sont réciproques (mois 0-indexé)', () => {
    const iso = '2026-11-15';
    const c = decomposerISO(iso);
    expect(c).toEqual({ annee: 2026, mois: 10, jour: 15 });
    expect(formatISO(c.annee, c.mois, c.jour)).toBe(iso);
  });
});

// ─── construireCycle ────────────────────────────────────────────────────────

describe('construireCycle', () => {
  const souscription = { id: 1 } as never;

  it('génère le bon nombre de lignes, les bonnes dates et montantDu = mise × coefficient (mois de 30)', () => {
    const cycle = construireCycle({
      souscription,
      numero: 1,
      dateDebut: '2026-04-01',
      dateFin: '2026-04-30',
      miseBase: 500,
      regularite: Regularite.JOUR,
    });

    expect(cycle.numero).toBe(1);
    expect(cycle.miseBase).toBe(500);
    expect(cycle.regularite).toBe(Regularite.JOUR);
    expect(cycle.dateDebut).toBe('2026-04-01');
    expect(cycle.dateFin).toBe('2026-04-30');
    expect(cycle.fondsCaisseRetenu).toBe(500);
    expect(cycle.statut).toBe(StatutCycle.EN_COURS);

    const jours = cycle.jourCotisations;
    expect(jours).toHaveLength(30);
    expect(jours[0].numeroJour).toBe(1);
    expect(jours[29].numeroJour).toBe(30);
    expect(jours[0].datePrevue).toBe('2026-04-01');
    expect(jours[29].datePrevue).toBe('2026-04-30');

    // Somme des coefficients = 31 → le dernier jour est doublé.
    expect(jours.reduce((s, j) => s + j.coefficient, 0)).toBe(31);
    expect(jours[29].coefficient).toBe(2);
    expect(jours[29].montantDu).toBe(500 * 2);
    expect(jours[0].montantDu).toBe(500 * 1);

    // Tous les jours commencent à « à payer », non payés.
    expect(jours.every((j) => j.statut === StatutJourCotisation.A_PAYER)).toBe(
      true,
    );
    expect(jours.every((j) => j.montantPaye === 0)).toBe(true);
  });

  it('génère 28 lignes pour février avec 3 jours doublés à la fin', () => {
    const cycle = construireCycle({
      souscription,
      numero: 2,
      dateDebut: '2026-02-01',
      dateFin: '2026-02-28',
      miseBase: 1000,
      regularite: Regularite.MOIS,
    });
    const jours = cycle.jourCotisations;
    expect(jours).toHaveLength(28);
    expect(jours.reduce((s, j) => s + j.coefficient, 0)).toBe(31);
    expect(jours[27].coefficient).toBe(2);
    expect(jours[26].coefficient).toBe(2);
    expect(jours[25].coefficient).toBe(2);
    expect(jours[27].montantDu).toBe(2000);
  });

  it('génère 29 lignes pour février bissextile avec 2 jours doublés', () => {
    const cycle = construireCycle({
      souscription,
      numero: 1,
      dateDebut: '2024-02-01',
      dateFin: '2024-02-29',
      miseBase: 200,
      regularite: Regularite.SEMAINE,
    });
    const jours = cycle.jourCotisations;
    expect(jours).toHaveLength(29);
    expect(jours.reduce((s, j) => s + j.coefficient, 0)).toBe(31);
    expect(jours[28].coefficient).toBe(2);
    expect(jours[27].coefficient).toBe(2);
  });

  it('génère un cycle court pour une inscription en milieu de mois (somme = 31)', () => {
    const cycle = construireCycle({
      souscription,
      numero: 1,
      dateDebut: '2026-11-15',
      dateFin: '2026-11-30',
      miseBase: 500,
      regularite: Regularite.JOUR,
    });
    const jours = cycle.jourCotisations;
    expect(jours).toHaveLength(16);
    expect(jours[0].datePrevue).toBe('2026-11-15');
    expect(jours[15].datePrevue).toBe('2026-11-30');
    expect(jours.reduce((s, j) => s + j.coefficient, 0)).toBe(31);
    expect(jours.reduce((s, j) => s + j.montantDu, 0)).toBe(500 * 31);
  });
});

// ─── calculerProchaineEcheance ──────────────────────────────────────────────

describe('calculerProchaineEcheance', () => {
  const J = (
    datePrevue: string,
    statut: StatutJourCotisation,
    montantDu = 500,
  ) => ({
    datePrevue,
    statut,
    montantDu,
  });

  it('renvoie le premier jour « à payer » à partir d’aujourd’hui', () => {
    const jours = [
      J('2026-11-01', StatutJourCotisation.PAYE),
      J('2026-11-02', StatutJourCotisation.PERDU),
      J('2026-11-12', StatutJourCotisation.A_PAYER, 1000),
      J('2026-11-13', StatutJourCotisation.A_PAYER, 500),
    ];
    expect(
      calculerProchaineEcheance(jours, Regularite.JOUR, '2026-11-12'),
    ).toEqual({
      date: '2026-11-12',
      montant: 1000,
    });
  });

  it('retombe sur le premier jour à payer si aucun n’est futur (jour en retard)', () => {
    const jours = [
      J('2026-11-01', StatutJourCotisation.PAYE),
      J('2026-11-02', StatutJourCotisation.PERDU),
      J('2026-11-03', StatutJourCotisation.A_PAYER, 500),
    ];
    expect(
      calculerProchaineEcheance(jours, Regularite.JOUR, '2026-11-12'),
    ).toEqual({
      date: '2026-11-03',
      montant: 500,
    });
  });

  it('renvoie null si aucun jour n’est à payer', () => {
    const jours = [
      J('2026-11-01', StatutJourCotisation.PAYE),
      J('2026-11-02', StatutJourCotisation.PERDU),
    ];
    expect(
      calculerProchaineEcheance(jours, Regularite.JOUR, '2026-11-12'),
    ).toBeNull();
  });
});
