#include canvas:shaders/pipeline/fog.glsl
#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/lib/color.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
#include canvas:basic_light_config

layout(location = 0) out vec4 out_color;

vec4 aoFactor(vec2 lightCoord, float ao) {
	return vec4(ao, ao, ao, 1.0);
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
		a *= mix(texture(frxs_lightmap, frx_fragLight.xy), frx_emissiveColor, frx_fragEmissive);

		float ao = frx_fragLight.z;
		a *= frx_fragEnableAo ? vec4(vec3(ao), 1.0) : vec4(1.0);

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

	glintify(a, float(frx_matGlint));
	out_color = p_fog(a);
	gl_FragDepth = gl_FragCoord.z;
}