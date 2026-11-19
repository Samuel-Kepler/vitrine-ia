"use client";
// Catálogo A2UI do preview: cada componente embrulha a versão React pura de
// ./landing-components (a mesma que vai no projeto React exportado).
// Só no navegador: @a2ui/react acessa HTMLElement ao ser importado.
import type { ReactNode } from "react";
import { createComponentImplementation } from "@a2ui/react/v0_9";
import {
  FeatureApi,
  FooterApi,
  GridApi,
  HeadingApi,
  HeroApi,
  NavbarApi,
  PageApi,
  PricingCardApi,
  SectionApi,
  TestimonialApi,
  buildCatalog,
} from "./catalog-api";
import { Feature, Footer, Grid, Heading, Hero, Navbar, Page, PricingCard, Section, Testimonial } from "./landing-components";

type Any = any; // tipos do renderer são v0_9; o runtime v1.0 é compatível.
type Build = (id: string, basePath?: string) => ReactNode;

function children(list: unknown, build: Build): ReactNode[] {
  if (!Array.isArray(list)) return [];
  return list.map((c) =>
    typeof c === "string" ? <div key={c}>{build(c)}</div> : <div key={`${c.id}:${c.basePath}`}>{build(c.id, c.basePath)}</div>,
  );
}

const PageView = createComponentImplementation(PageApi as Any, ({ props, buildChild }: Any) => <Page palette={props.palette}>{props.child ? buildChild(props.child) : null}</Page>);

const NavbarView = createComponentImplementation(NavbarApi as Any, ({ props }: Any) => <Navbar brand={props.brand} links={props.links} cta={props.cta} onCta={props.onCta} />);

const HeroView = createComponentImplementation(HeroApi as Any, ({ props }: Any) => (
  <Hero title={props.title} subtitle={props.subtitle} cta={props.cta} onCta={props.onCta} image={props.image} eyebrow={props.eyebrow} />
));

const HeadingView = createComponentImplementation(HeadingApi as Any, ({ props }: Any) => <Heading text={props.text} level={props.level} align={props.align} />);

const SectionView = createComponentImplementation(SectionApi as Any, ({ props, buildChild }: Any) => <Section tone={props.tone}>{props.child ? buildChild(props.child) : null}</Section>);

const GridView = createComponentImplementation(GridApi as Any, ({ props, buildChild }: Any) => <Grid columns={props.columns}>{children(props.children, buildChild)}</Grid>);

const FeatureView = createComponentImplementation(FeatureApi as Any, ({ props }: Any) => <Feature icon={props.icon} title={props.title} text={props.text} />);

const TestimonialView = createComponentImplementation(TestimonialApi as Any, ({ props }: Any) => <Testimonial quote={props.quote} author={props.author} role={props.role} />);

const PricingCardView = createComponentImplementation(PricingCardApi as Any, ({ props }: Any) => (
  <PricingCard name={props.name} price={props.price} period={props.period} features={props.features} cta={props.cta} onCta={props.onCta} highlighted={props.highlighted} />
));

const FooterView = createComponentImplementation(FooterApi as Any, ({ props }: Any) => <Footer text={props.text} links={props.links} />);

export const landingCatalog = buildCatalog([PageView, NavbarView, HeroView, HeadingView, SectionView, GridView, FeatureView, TestimonialView, PricingCardView, FooterView] as Any);
