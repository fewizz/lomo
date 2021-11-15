#include canvas:shaders/pipeline/fog.glsl
#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/varying.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/lib/color.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl
#include canvas:basic_light_config
#include canvas:handheld_light_config

#include lomo:shaders/lib/sky.glsl

/* lomo:pipeline/lomo.frag */

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_extra;

#ifdef SHADOW_MAP_PRESENT
varying vec4 shadowPos;
#endif

#if HANDHELD_LIGHT_RADIUS != 0
flat in float _cvInnerAngle;
flat in float _cvOuterAngle;
in vec4 _cvViewVertex;
#endif

#if AO_SHADING_MODE != AO_MODE_NONE
vec4 aoFactor(vec2 lightCoord, float ao) {

#if AO_SHADING_MODE == AO_MODE_SUBTLE_BLOCK_LIGHT || AO_SHADING_MODE == AO_MODE_SUBTLE_ALWAYS
	// accelerate the transition from 0.4 (should be the minimum) to 1.0
	float bao = (ao - 0.4) / 0.6;
	bao = clamp(bao, 0.0, 1.0);
	bao = 1.0 - bao;
	bao = bao * bao * (1.0 - lightCoord.x * 0.6);
	bao = 0.4 + (1.0 - bao) * 0.6;

	#if AO_SHADING_MODE == AO_MODE_SUBTLE_ALWAYS
	return vec4(bao, bao, bao, 1.0);
	#else
	vec4 sky = texture(frxs_lightmap, vec2(0.03125, lightCoord.y));
	ao = mix(bao, ao, frx_luminance(sky.rgb));
	return vec4(ao, ao, ao, 1.0);
	#endif
#else
	return vec4(ao, ao, ao, 1.0);
#endif
}
#endif

vec4 light() {
	vec4 result;

#if DIFFUSE_SHADING_MODE == DIFFUSE_MODE_SKY_ONLY
	if (frx_fragEnableDiffuse) {
		vec4 block = texture(frxs_lightmap, vec2(frx_fragLight.x, 0.03125));
		vec4 sky = texture(frxs_lightmap, vec2(0.03125, frx_fragLight.y));
		result = max(block, sky * pv_diffuse);
	} else {
		result = texture(frxs_lightmap, frx_fragLight.xy);
	}
#else
	result = texture(frxs_lightmap, frx_fragLight.xy);
#endif

	//result *= vec4(sky_color(normalize(frx_vertexNormal), 1.0), 1.0) * 2;

#if HANDHELD_LIGHT_RADIUS != 0
	vec4 held = frx_heldLight;

	if (held.w > 0.0 && (!frx_isGui || frx_isHand)) {
		float d = clamp(frx_distance / (held.w * HANDHELD_LIGHT_RADIUS), 0.0, 1.0);
		d = 1.0 - d * d;

		// handle spot lights
		if (_cvInnerAngle != 0.0) {
			float distSq = _cvViewVertex.x * _cvViewVertex.x + _cvViewVertex.y * _cvViewVertex.y;
			float innerLimitSq = _cvInnerAngle * frx_distance;
			innerLimitSq *= innerLimitSq;
			float outerLimitSq = _cvOuterAngle * frx_distance;
			outerLimitSq *= outerLimitSq;

			d = distSq < innerLimitSq ? d :
					distSq < outerLimitSq ? d * (1.0 - (distSq - innerLimitSq) / (outerLimitSq - innerLimitSq)) : 0.0;
		}

		vec4 maxBlock = texture(frxs_lightmap, vec2(0.96875, 0.03125));

		held = vec4(held.xyz, 1.0) * maxBlock * d;

		result = min(result + held, 1.0);
	}
#endif

	return result;
}

void frx_pipelineFragment() {
	vec4 a = frx_fragColor;

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			float df = p_diffuseGui(frx_vertexNormal);
			df = df + (1.0 - df) * frx_fragEmissive;
			a *= vec4(df, df, df, 1.0);
		}
	} else {
		a *= mix(light(), frx_emissiveColor, frx_fragEmissive);

	#if AO_SHADING_MODE != AO_MODE_NONE
		a *= frx_fragEnableAo ? aoFactor(frx_fragLight.xy, frx_fragLight.z) : vec4(1.0);
	#endif

	#if DIFFUSE_SHADING_MODE == DIFFUSE_MODE_NORMAL
		if (frx_fragEnableDiffuse) {
			float df = pv_diffuse + (1.0 - pv_diffuse) * frx_fragEmissive;

			a *= vec4(df, df, df, 1.0);
		}
	#endif
	}

	if (frx_matFlash == 1) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt == 1) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	glintify(a, float(frx_matGlint));

	out_color = p_fog(a);

	if(
		frx_renderTargetSolid ||
		frx_renderTargetTranslucent ||
		frx_renderTargetParticles ||
		frx_renderTargetEntity
	) {
		if(frag_normal == vec3(0.0)) frag_normal = normalize(frx_vertexNormal);

		out_normal = vec4(frag_normal * 0.5 + 0.5, 1.);
		out_extra = vec4(reflectivity, frx_fragLight.y, 0.0, 1.0);
	}
	else {
		out_normal = vec4(0);
		out_extra = vec4(0);
	}

	gl_FragDepth = gl_FragCoord.z;
}
