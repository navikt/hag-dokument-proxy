# Dokument Proxy

Dette er en app for visning av pdf dokumenter for arbeidsgivere.

bruker node og express

Dette repoet bruker Github Copilot til å generere kode

## Hvordan Proxy appen funker

Denne proxy appen er et mellomlag i våre systemer mellom altinn innboks brukere og våre interne systemer.
Proxy appen håndterer kompleksiteten av autentisering, bruker login og omdirigering til feilsider.  
For å gi en oversikt er det inkludert sekvens diagram for å vise hvordan systemene samhandler og i hvilken rekkefølge ting skjer.

## Sykepenger PDF fra LPS API

Brukeren åpner dialogen, klikker på lenken, og dokumentet hentes og returneres. Når lps-api blir bedt om PDF-en, gjør den i tillegg et kall til pdfgen for å generere PDF-en:

```mermaid
sequenceDiagram
    autonumber
    actor User as Bruker
    participant Altinn as Altinn 3
    participant Proxy as hag-dokument-proxy
    participant LPS as lps-api
    participant Pdfgen as pdfgen

    User->>Altinn: Åpne dialog
    Altinn-->>User: Vis lenke (peker til hag-dokument-proxy)

    User->>Proxy: Klikk på lenke (med dokument-ID)
    Proxy->>LPS: Be om PDF (med ID)
    LPS->>Pdfgen: Be om generering av PDF
    Pdfgen-->>LPS: Returner PDF
    LPS-->>Proxy: Returner PDF
    Proxy-->>User: Returner PDF
```

## FritakAGP PDF

Brukeren åpner dialogen og klikker på lenken. fritakagp returnerer kun en JSON-versjon av dataene, og proxyen gjør deretter et kall til pdfgen for å konvertere JSON til PDF:

```mermaid
sequenceDiagram
    autonumber
    actor User as Bruker
    participant Altinn as Altinn 3
    participant Proxy as hag-dokument-proxy
    participant Fritak as fritakagp
    participant Pdfgen as pdfgen

    User->>Altinn: Åpne dialog
    Altinn-->>User: Vis lenke (peker til hag-dokument-proxy)

    User->>Proxy: Klikk på lenke (med dokument-ID)
    Proxy->>Fritak: Be om data (med ID)
    Fritak-->>Proxy: Returner data som JSON
    Proxy->>Pdfgen: Send JSON for konvertering til PDF
    Pdfgen-->>Proxy: Returner PDF
    Proxy-->>User: Returner PDF
```
