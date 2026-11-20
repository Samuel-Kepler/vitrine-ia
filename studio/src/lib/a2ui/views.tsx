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
  StatApi,
  FaqItemApi,
  StepApi,
  TeamMemberApi,
  MenuItemApi,
  ContactInfoApi,
  LogoStripApi,
  GalleryApi,
  buildCatalog,
} from "./catalog-api";
import { ContactInfo, FaqItem, Feature, Footer, Gallery, Grid, Heading, Hero, LogoStrip, MenuItem, Navbar, Page, PricingCard, Section, Stat, Step, TeamMember, Testimonial } from "./landing-components";

type Any = any; // tipos do renderer são v0_9; o runtime v1.0 é compatível.
type Build = (id: string, basePath?: string) => ReactNode;

function children(list: unknown, build: Build): ReactNode[] {
  if (!Array.isArray(list)) return [];
  return list.map((c) =>
    typeof c === "string" ? <div key={c}>{build(c)}</div> : <div key={`${c.id}:${c.basePath}`}>{build(c.id, c.basePath)}</div>,
  );
}

const PageView = createComponentImplementation(PageApi as Any, ({ props, buildChild }: Any) => <Page palette={props.palette} theme={props.theme} motion={props.motion}>{props.child ? buildChild(props.child) : null}</Page>);

const NavbarView = createComponentImplementation(NavbarApi as Any, ({ props }: Any) => <Navbar brand={props.brand} links={props.links} cta={props.cta} onCta={props.onCta} />);

const HeroView = createComponentImplementation(HeroApi as Any, ({ props }: Any) => (
  <Hero title={props.title} subtitle={props.subtitle} cta={props.cta} onCta={props.onCta} image={props.image} eyebrow={props.eyebrow} variant={props.variant} />
));

const HeadingView = createComponentImplementation(HeadingApi as Any, ({ props }: Any) => <Heading text={props.text} level={props.level} align={props.align} />);

const SectionView = createComponentImplementation(SectionApi as Any, ({ props, buildChild }: Any) => <Section tone={props.tone} animation={props.animation}>{props.child ? buildChild(props.child) : null}</Section>);

const GridView = createComponentImplementation(GridApi as Any, ({ props, buildChild }: Any) => <Grid columns={props.columns} variant={props.variant}>{children(props.children, buildChild)}</Grid>);

const FeatureView = createComponentImplementation(FeatureApi as Any, ({ props }: Any) => <Feature icon={props.icon} title={props.title} text={props.text} variant={props.variant} />);

const TestimonialView = createComponentImplementation(TestimonialApi as Any, ({ props }: Any) => <Testimonial quote={props.quote} author={props.author} role={props.role} variant={props.variant} />);

const PricingCardView = createComponentImplementation(PricingCardApi as Any, ({ props }: Any) => (
  <PricingCard name={props.name} price={props.price} period={props.period} features={props.features} cta={props.cta} onCta={props.onCta} highlighted={props.highlighted} />
));

const FooterView = createComponentImplementation(FooterApi as Any, ({ props }: Any) => <Footer text={props.text} links={props.links} />);

const StatView = createComponentImplementation(StatApi as Any, ({ props }: Any) => <Stat value={props.value} label={props.label} />);
const FaqItemView = createComponentImplementation(FaqItemApi as Any, ({ props }: Any) => <FaqItem question={props.question} answer={props.answer} />);
const StepView = createComponentImplementation(StepApi as Any, ({ props }: Any) => <Step index={props.index} title={props.title} text={props.text} />);
const TeamMemberView = createComponentImplementation(TeamMemberApi as Any, ({ props }: Any) => <TeamMember name={props.name} role={props.role} bio={props.bio} photo={props.photo} />);
const MenuItemView = createComponentImplementation(MenuItemApi as Any, ({ props }: Any) => <MenuItem name={props.name} price={props.price} description={props.description} photo={props.photo} />);
const ContactInfoView = createComponentImplementation(ContactInfoApi as Any, ({ props }: Any) => (
  <ContactInfo hours={props.hours} address={props.address} phone={props.phone} email={props.email} whatsapp={props.whatsapp} />
));
const LogoStripView = createComponentImplementation(LogoStripApi as Any, ({ props }: Any) => <LogoStrip title={props.title} names={props.names} variant={props.variant} />);
const GalleryView = createComponentImplementation(GalleryApi as Any, ({ props }: Any) => <Gallery images={props.images} captions={props.captions} />);

export const landingCatalog = buildCatalog(
  [PageView, NavbarView, HeroView, HeadingView, SectionView, GridView, FeatureView, TestimonialView, PricingCardView, StatView, FaqItemView, StepView, TeamMemberView, MenuItemView, ContactInfoView, LogoStripView, GalleryView, FooterView] as Any,
);
