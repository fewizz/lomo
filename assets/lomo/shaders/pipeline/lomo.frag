#define DIFFUSE_SHADING_MODE 1

#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl

#include frex:shaders/api/world.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/pipeline/header.glsl

/* lomo:pipeline/lomo.frag */

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_geometric_normal;
layout(location = 3) out vec4 out_extra_0;
layout(location = 4) out vec4 out_extra_1;

void frx_pipelineFragment() {
	vec4 a = frx_fragColor;

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			float df = p_diffuseGui(frx_vertexNormal);
			df = df + (1.0 - df) * frx_fragEmissive;
			a *= vec4(df, df, df, 1.0);
		}
	}
	else if (frx_isHand) {
		a *= mix(texture(frxs_lightmap, frx_fragLight.xy), frx_emissiveColor, frx_fragEmissive);

		if (frx_fragEnableDiffuse) {
			float df = pv_diffuse + (1.0 - pv_diffuse) * frx_fragEmissive * 0.5f;
			a *= vec4(df, df, df, 1.0);
		}
	}

	if (frx_matFlash == 1) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt == 1) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	//glintify(a, float(frx_matGlint));

	out_color = a;

	if(
		frx_renderTargetSolid ||
		frx_renderTargetTranslucent ||
		frx_renderTargetParticles ||
		frx_renderTargetEntity
	) {
		vec3 geometric_normal = normalize(frx_vertexNormal);
		vec3 tangent = normalize(frx_vertexTangent.xyz);
		mat3 TBN = mat3(
			tangent,
			cross(geometric_normal, tangent),
			geometric_normal
		);

		vec3 normal = TBN * frx_fragNormal;

		if(!frx_isHand) {
			normal = raw_normal_to_cam(normal);
			geometric_normal = raw_normal_to_cam(geometric_normal);
		}

		out_geometric_normal = vec4(geometric_normal, 1.0);
		out_normal = vec4(normal, 1.0);

		frx_fragRoughness = mix(
			frx_fragRoughness,
			0.3,
			frx_fragRoughness * frx_smoothedRainGradient * pow(frx_fragLight.y * 1.06, 8.0)
		);

		out_extra_0 = vec4(
			clamp(frx_fragRoughness, 0.0, 1.0),
			clamp(frx_fragLight.y, 0.0, 1.0),
			clamp(frx_fragLight.x, 0.0, 1.0),
			1.0
		);
		out_extra_1 = vec4(
			clamp(frx_fragReflectance, 0.0, 1.0),
			  max(frx_fragEmissive, 0.0),
			0.0,
			1.0
		);
	}
	else {
		out_geometric_normal = vec4(0.0);
		out_normal = vec4(0.0);
		out_extra_0 = vec4(0.0);
		out_extra_1 = vec4(0.0);
	}

	gl_FragDepth = gl_FragCoord.z;
}
