import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { cleanDuplicateSlash } from "./fetch";

const useStyles = makeStyles((theme) => ({
  logo: {
    height: 37,
    width: 37,
    marginRight: 8,
  },
}));

export default function AppLogo() {
  const classes = useStyles();
  const logoPath = "/vodafone-logo.svg";
  return <img src={cleanDuplicateSlash(logoPath)} alt="Vodafone" className={classes.logo} />;
}
