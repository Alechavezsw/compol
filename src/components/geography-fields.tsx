"use client";

import { useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { SAN_JUAN_DEPARTMENTS, composeGeography, districtsOf } from "@/lib/san-juan-geography";

export function GeographyFields({
  defaultDepartment = "",
  defaultDistrict = "",
}: {
  defaultDepartment?: string;
  defaultDistrict?: string;
}) {
  const [department, setDepartment] = useState(defaultDepartment);
  const [district, setDistrict] = useState(defaultDistrict);
  const districts = useMemo(() => districtsOf(department), [department]);
  const geography = composeGeography(department, district);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Departamento" hint="Los 19 de San Juan, ya cargados.">
        <Select
          value={department}
          onChange={(event) => {
            setDepartment(event.target.value);
            setDistrict("");
          }}
        >
          <option value="">Toda la provincia</option>
          {SAN_JUAN_DEPARTMENTS.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Distrito"
        hint={department ? "Del departamento elegido." : "Elegí primero el departamento."}
      >
        <Select
          value={district}
          disabled={!districts.length}
          onChange={(event) => setDistrict(event.target.value)}
        >
          <option value="">{districts.length ? "Todo el departamento" : "—"}</option>
          {districts.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>
      <input type="hidden" name="geography" value={geography} />
    </div>
  );
}
