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
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_data;

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

		/*vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

		vec4 world_near0 = frx_inverseViewProjectionMatrix * vec4(ndc_near, 1.0);
		vec4 world_far0  = frx_inverseViewProjectionMatrix * vec4(ndc_far, 1.0);
		vec3 world_near = world_near0.xyz / world_near0.w;
		vec3 world_far  = world_far0.xyz  / world_far0.w;

		vec3 dir = normalize(world_far - world_near);

		a *= textureLod(u_skybox, dir, 0.0);*/

		if (frx_fragEnableDiffuse) {
			float df = pv_diffuse + (1.0 - pv_diffuse) * frx_fragEmissive * 0.5f;

			//a *= vec4(df, df, df, 1.0);
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

	vec3 geometric_normal = normalize(frx_vertexNormal);
	vec3 tangent = normalize(frx_vertexTangent.xyz);
	mat3 TBN = mat3(
		tangent,
		cross(geometric_normal, tangent),
		geometric_normal
	);

	vec3 normal = TBN * frx_fragNormal;

	if(!frx_isHand) {
		normal = mat3(frx_viewMatrix) * normal;
		//geometric_normal = mat3(frx_viewMatrix) * geometric_normal;
	}

	out_normal = vec4(normal, 1.0);
	out_data = vec4(frx_fragLight.xy, frx_fragRoughness, 1.0);
}