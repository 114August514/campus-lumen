import { ChevronDownIcon, ChevronRightIcon } from "@primer/octicons-react";
import { Button, Details, Stack, useDetails } from "@primer/react";
import type { ReactNode } from "react";

/** Progressive disclosure with a visible, keyboard-reachable toggle and chevron. */
export function Disclosure({
  summary,
  openSummary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  openSummary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { getDetailsProps, open } = useDetails({
    closeOnOutsideClick: false,
    defaultOpen,
  });
  return (
    <Details {...getDetailsProps()}>
      <Button
        as="summary"
        variant="invisible"
        size="small"
        alignContent="start"
        leadingVisual={open ? ChevronDownIcon : ChevronRightIcon}
      >
        {open ? (openSummary ?? summary) : summary}
      </Button>
      <Stack gap="condensed" padding="condensed">
        {children}
      </Stack>
    </Details>
  );
}
