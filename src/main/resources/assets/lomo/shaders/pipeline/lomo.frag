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

// lomo:lomo.frag

out vec4 out_data[2];

#ifdef SHADOW_MAP_PRESENT
varying vec4 shadowPos;
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

vec4 light(frx_FragmentData fragData) {
	vec4 result;

#if DIFFUSE_SHADING_MODE == DIFFUSE_MODE_SKY_ONLY
	if (fragData.diffuse) {
		vec4 block = texture(frxs_lightmap, vec2(fragData.light.x, 0.03125));
		vec4 sky = texture(frxs_lightmap, vec2(0.03125, fragData.light.y));
		result = max(block, sky * pv_diffuse);
	} else {
		result = texture(frxs_lightmap, fragData.light);
	}
#else
	result = texture(frxs_lightmap, fragData.light);
#endif

#if HANDHELD_LIGHT_RADIUS != 0
	vec4 held = frx_heldLight();

	if (held.w > 0.0 && !frx_isGui()) {
		float d = clamp(frx_distance / (held.w * HANDHELD_LIGHT_RADIUS), 0.0, 1.0);
		d = 1.0 - d * d;

		vec4 maxBlock = texture(frxs_lightmap, vec2(0.96875, 0.03125));

		held = vec4(held.xyz, 1.0) * maxBlock * d;

		result = min(result + held, 1.0);
	}
#endif

	return result;
}

frx_FragmentData frx_createPipelineFragment() {
#ifdef VANILLA_LIGHTING
	return frx_FragmentData (
		texture(frxs_baseColor, frx_texcoord, frx_matUnmippedFactor() * -4.0),
		frx_color,
		frx_matEmissive() ? 1.0 : 0.0,
		!frx_matDisableDiffuse(),
		!frx_matDisableAo(),
		frx_normal,
		pv_lightcoord,
		pv_ao
	);
#else
	return frx_FragmentData (
		texture2D(frxs_baseColor, frx_texcoord, frx_matUnmippedFactor() * -4.0),
		frx_color,
		frx_matEmissive() ? 1.0 : 0.0,
		!frx_matDisableDiffuse(),
		!frx_matDisableAo(),
		frx_normal
	);
#endif
}

void frx_writePipelineFragment(in frx_FragmentData fragData) {
	vec4 a = fragData.spriteColor * fragData.vertexColor;

	if (frx_isGui() && !frx_isHand()) {
		if (fragData.diffuse) {
			float df = p_diffuseGui(frx_normal);
			df = df + (1.0 - df) * fragData.emissivity;
			a *= vec4(df, df, df, 1.0);
		}
	} else {
		// TODO: put back
		a *= mix(light(fragData), frx_emissiveColor(), fragData.emissivity);

	#if AO_SHADING_MODE != AO_MODE_NONE
		if (fragData.ao) {
			a *= aoFactor(fragData.light, fragData.aoShade);
		}
	#endif

	#if DIFFUSE_SHADING_MODE == DIFFUSE_MODE_NORMAL
		if (fragData.diffuse) {
			float df = pv_diffuse + (1.0 - pv_diffuse) * fragData.emissivity;

			a *= vec4(df, df, df, 1.0);
		}
	#endif
	}

	if (frx_matFlash()) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt()) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	glintify(a, frx_matGlint());

	out_data[0] = p_fog(a);
	out_data[1] = vec4(fragData.vertexNormal * 0.5 + 0.5, reflectivity);

	gl_FragDepth = gl_FragCoord.z;
	//gl_FragData[TARGET_EMISSIVE] = vec4(fragData.emissivity * a.a, 0.0, 0.0, 1.0);
}
